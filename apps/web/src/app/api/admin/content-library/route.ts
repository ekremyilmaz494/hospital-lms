import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  safePagination,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { turkishSearchIds } from '@/lib/turkish-search'
import {
  getUploadUrl,
  getStreamUrl,
  videoKey,
  documentKey,
  audioKey,
  getOrgStorageBytes,
} from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/content-library
 *
 * Kurumun erişebildiği aktif içerikler + isInstalled flag.
 * Platform içerikleri (organizationId = null) + kurumun kendi yüklediği içerikler.
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  // max 500 — bu liste organizasyon-genelinde gösterilir
  const { page, limit, skip, search } = safePagination(searchParams, 500)

  const where: Record<string, unknown> = {
    isActive: true,
    OR: [
      { organizationId: null },
      { organizationId: organizationId },
    ],
  }
  if (category) where.category = category
  if (search) {
    // Türkçe-duyarlı arama (bkz. turkishSearchIds) — platform + kurum içeriği birlikte
    where.id = { in: await turkishSearchIds('content_library', ['title'], search) }
  }

  // 1. dalga: paginate liste, total, kurumun installed ID seti, ve org-genelinde
  // KPI agregasyonları (durum/SMG toplamı). KPI'lar tüm filtre kapsamına ait,
  // sadece sayfaya değil — frontend'in hesapladığı totalDurationMin/totalSmg/installRate
  // doğru kalsın.
  const [items, total, installs, totalsAgg, installedCount] = await Promise.all([
    prisma.contentLibrary.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.contentLibrary.count({ where }),
    prisma.organizationContentLibrary.findMany({
      where: { organizationId },
      select: { contentLibraryId: true },
    }),
    prisma.contentLibrary.aggregate({
      where,
      _sum: { duration: true, smgPoints: true },
    }),
    // Filtre kapsamındaki içeriklerden kaçı bu kuruma yüklenmiş
    prisma.contentLibrary.count({
      where: {
        ...where,
        installs: { some: { organizationId } },
      },
    }),
  ])

  const installedSet = new Set(installs.map(i => i.contentLibraryId))

  // Sadece görünür sayfanın thumbnail URL'lerini imzala — sayfa başına ~24-100 imza,
  // tüm 500 öğe yerine. CloudFront imza maliyeti ve latency düşüyor.
  const resolved = await Promise.all(
    items.map(async item => {
      let thumbnailUrl = item.thumbnailUrl
      if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
        try {
          thumbnailUrl = await getStreamUrl(thumbnailUrl)
        } catch {
          thumbnailUrl = null
        }
      }
      return {
        ...item,
        thumbnailUrl,
        targetRoles: item.targetRoles as string[],
        isInstalled: installedSet.has(item.id),
        isOwned: item.organizationId === organizationId,
      }
    }),
  )

  return jsonResponse({
    items: resolved,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    stats: {
      installedCount,
      installRate: total > 0 ? Math.round((installedCount / total) * 100) : 0,
      totalDurationMin: totalsAgg._sum.duration ?? 0,
      totalSmg: totalsAgg._sum.smgPoints ?? 0,
    },
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

/**
 * POST /api/admin/content-library
 *
 * Kurum için yeni içerik yükle (S3 presigned URL akışı):
 * 1) Her dosya için S3 presigned URL üret.
 * 2) content_library tablosuna organizationId=currentOrg ile kayıt ekle.
 * Client presigned URL'e dosyayı PUT ile yükler.
 *
 * Body:
 * {
 *   files: [{ fileName, contentType, title?, category?, description?,
 *             difficulty?, targetRoles?, smgPoints?, durationSeconds? }]
 * }
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const allowed = await checkRateLimit(`content-library-upload:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = await request.json() as {
      files: Array<{
        fileName: string
        contentType: string
        fileSize?: number
        title?: string
        category?: string
        description?: string
        difficulty?: string
        targetRoles?: string[]
        smgPoints?: number
        durationSeconds?: number
      }>
    }

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return errorResponse('En az bir dosya gerekli', 400)
    }

    if (body.files.length > 20) {
      return errorResponse('Tek seferde en fazla 20 dosya yüklenebilir', 400)
    }

    // Storage quota — toplam yüklenecek byte'ı önceden hesap et, organizasyonun
    // limitini aşıyorsa hiç presign etmeden 413 dön. Plana göre maxStorageGb
    // çekilir; client fileSize göndermezse 0 sayılır (geriye uyumluluk).
    const totalIncomingBytes = body.files.reduce((s, f) => s + (typeof f.fileSize === 'number' && f.fileSize > 0 ? f.fileSize : 0), 0)
    if (totalIncomingBytes > 0) {
      const subscription = await prisma.organizationSubscription.findFirst({
        where: { organizationId },
        include: { plan: { select: { maxStorageGb: true } } },
      })
      const maxGb = subscription?.plan?.maxStorageGb ?? 10
      const maxBytes = maxGb * 1024 * 1024 * 1024
      const usedBytes = await getOrgStorageBytes(organizationId)
      if (usedBytes + totalIncomingBytes > maxBytes) {
        const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1)
        const incomingGb = (totalIncomingBytes / (1024 * 1024 * 1024)).toFixed(2)
        return errorResponse(
          `Depolama limitinizi aşıyor: ${usedGb}GB kullanılıyor + ${incomingGb}GB yüklenmek isteniyor (limit ${maxGb}GB). Planınızı yükseltin veya dosyalarınızı azaltın.`,
          413,
        )
      }
    }

    // Her dosya bağımsız: presign + DB create paralel çalıştır.
    // allSettled ile bir dosyanın hatası diğerlerini engellemez.
    const settled = await Promise.allSettled(
      body.files.map(async file => {
        if (!file.fileName || !file.contentType) {
          return { fileName: file.fileName, error: 'fileName ve contentType gerekli' }
        }

        let key: string
        let detectedType: string
        let detectedFileType: string
        if (file.contentType.startsWith('video/')) {
          key = videoKey(organizationId, 'content-library', file.fileName)
          detectedType = 'video'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
        } else if (file.contentType.startsWith('audio/')) {
          key = audioKey(organizationId, 'content-library', file.fileName)
          detectedType = 'audio'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp3'
        } else if (file.contentType === 'application/pdf' || file.contentType.includes('presentation')) {
          key = documentKey(organizationId, 'content-library', file.fileName)
          detectedType = 'pdf'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'pdf'
        } else {
          return { fileName: file.fileName, error: 'Desteklenmeyen dosya türü' }
        }

        const thumbnailKey = detectedType === 'video'
          ? key.replace(/\.[^./]+$/, '') + '.thumb.jpg'
          : null

        // Presign çağrılarını da paralelle: video için 2 presign aynı anda gider.
        const [uploadUrl, thumbnailUploadUrl] = await Promise.all([
          getUploadUrl(key, file.contentType),
          thumbnailKey ? getUploadUrl(thumbnailKey, 'image/jpeg') : Promise.resolve(null),
        ])

        const title = file.title || file.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

        // s3Key'ler crypto.randomUUID() ile üretildiği için pratikte çakışmaz —
        // ama (organizationId, s3Key) unique constraint'inin tetiklediği nadir
        // race-condition'da kullanıcıya 500 yerine düzgün Türkçe hata göstermek
        // için Prisma P2002'yi yakalayıp dosya bazında error döndürürüz.
        let item: { id: string; title: string; contentType: string | null; s3Key: string | null; createdAt: Date }
        try {
          item = await prisma.contentLibrary.create({
            data: {
              title,
              description: file.description ?? null,
              category: file.category || 'INFECTION_CONTROL',
              contentType: detectedType,
              fileType: detectedFileType,
              s3Key: key,
              thumbnailUrl: thumbnailKey,
              duration: file.durationSeconds ? Math.ceil(file.durationSeconds / 60) : 0,
              difficulty: file.difficulty || 'BASIC',
              targetRoles: file.targetRoles && file.targetRoles.length > 0 ? file.targetRoles : ['all'],
              smgPoints: typeof file.smgPoints === 'number' ? file.smgPoints : 0,
              fileSizeBytes: typeof file.fileSize === 'number' && file.fileSize > 0 ? BigInt(Math.floor(file.fileSize)) : null,
              isActive: true,
              organizationId,
              createdById: dbUser.id,
            },
            select: {
              id: true,
              title: true,
              contentType: true,
              s3Key: true,
              createdAt: true,
            },
          })
        } catch (createErr) {
          const code = (createErr as { code?: string })?.code
          if (code === 'P2002') {
            return { fileName: file.fileName, error: 'Bu dosya zaten kütüphanenizde mevcut' }
          }
          throw createErr
        }

        return {
          ...item,
          uploadUrl,
          thumbnailUploadUrl,
          fileName: file.fileName,
        }
      }),
    )

    const results: Array<Record<string, unknown>> = settled.map((r, idx) => {
      if (r.status === 'fulfilled') return r.value as Record<string, unknown>
      return {
        fileName: body.files[idx]?.fileName,
        error: (r.reason as Error)?.message ?? 'Bilinmeyen hata',
      }
    })

    logger.info(
      'content-library',
      `${results.filter(r => !('error' in r)).length} içerik yüklendi`,
      { orgId: organizationId, userId: dbUser.id },
    )

    return jsonResponse({ results }, 201)
  } catch (err) {
    logger.error('content-library', 'İçerik yükleme hatası', err)
    return errorResponse('İçerik yüklenemedi', 500)
  }
}, { requireOrganization: true })
