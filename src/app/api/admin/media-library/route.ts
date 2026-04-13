import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { getUploadUrl, videoKey, documentKey, audioKey, getStreamUrl } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/media-library — Org'un medya kütüphanesi
 * content_library tablosundan organizationId = currentOrg olanları getirir.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const contentType = searchParams.get('contentType') // video | pdf | audio
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {
    organizationId: orgId,
    isActive: true,
  }
  if (contentType) where.contentType = contentType
  if (category) where.category = category
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.contentLibrary.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        contentType: true,
        fileType: true,
        s3Key: true,
        duration: true,
        thumbnailUrl: true,
        createdAt: true,
        // Kullanıldığı eğitim sayısı
        trainings: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contentLibrary.count({ where }),
  ])

  // Thumbnail signed URL'lerini paralel üret (S3 key → geçici indirilebilir URL)
  const itemsWithThumb = await Promise.all(
    items.map(async (item) => {
      let thumbUrl: string | null = null
      if (item.thumbnailUrl) {
        try {
          thumbUrl = await getStreamUrl(item.thumbnailUrl)
        } catch {
          thumbUrl = null
        }
      }
      return {
        ...item,
        thumbnailUrl: thumbUrl,
        usageCount: item.trainings.length,
        trainings: undefined,
      }
    }),
  )

  return jsonResponse({
    items: itemsWithThumb,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
}

/**
 * POST /api/admin/media-library — Yeni medya yükle
 * 1) Presigned URL oluştur
 * 2) content_library'ye kayıt ekle
 * Client presigned URL'e dosyayı PUT ile yükler.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`media-upload:${dbUser!.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = await request.json() as {
      files: Array<{
        fileName: string
        contentType: string
        title?: string
        category?: string
        durationSeconds?: number
      }>
    }

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return errorResponse('En az bir dosya gerekli', 400)
    }

    if (body.files.length > 20) {
      return errorResponse('Tek seferde en fazla 20 dosya yüklenebilir', 400)
    }

    const results = []

    for (const file of body.files) {
      if (!file.fileName || !file.contentType) {
        results.push({ fileName: file.fileName, error: 'fileName ve contentType gerekli' })
        continue
      }

      // S3 key oluştur
      let key: string
      let detectedType: string
      let detectedFileType: string
      try {
        if (file.contentType.startsWith('video/')) {
          key = videoKey(orgId, 'media-library', file.fileName)
          detectedType = 'video'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
        } else if (file.contentType.startsWith('audio/')) {
          key = audioKey(orgId, 'media-library', file.fileName)
          detectedType = 'audio'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp3'
        } else if (file.contentType === 'application/pdf' || file.contentType.includes('presentation')) {
          key = documentKey(orgId, 'media-library', file.fileName)
          detectedType = 'pdf'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'pdf'
        } else {
          results.push({ fileName: file.fileName, error: 'Desteklenmeyen dosya türü' })
          continue
        }
      } catch (err) {
        results.push({ fileName: file.fileName, error: (err as Error).message })
        continue
      }

      // Presigned URL al
      const uploadUrl = await getUploadUrl(key, file.contentType)

      // Video ise thumbnail için ayrı presigned URL üret
      let thumbnailKey: string | null = null
      let thumbnailUploadUrl: string | null = null
      if (detectedType === 'video') {
        thumbnailKey = key.replace(/\.[^./]+$/, '') + '.thumb.jpg'
        thumbnailUploadUrl = await getUploadUrl(thumbnailKey, 'image/jpeg')
      }

      // content_library'ye kayıt ekle
      const title = file.title || file.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      const item = await prisma.contentLibrary.create({
        data: {
          title,
          description: null,
          category: file.category || 'Genel',
          contentType: detectedType,
          fileType: detectedFileType,
          s3Key: key,
          thumbnailUrl: thumbnailKey, // S3 key; GET sırasında signed URL'e çevrilecek
          duration: file.durationSeconds ? Math.ceil(file.durationSeconds / 60) : 0,
          difficulty: 'BASIC',
          targetRoles: ['all'],
          isActive: true,
          organizationId: orgId,
          createdById: dbUser!.id,
        },
        select: {
          id: true,
          title: true,
          contentType: true,
          s3Key: true,
          createdAt: true,
        },
      })

      results.push({
        ...item,
        uploadUrl,
        thumbnailUploadUrl,
        fileName: file.fileName,
      })
    }

    logger.info('media-library', `${results.filter(r => !('error' in r)).length} medya kaydı oluşturuldu`, { orgId, userId: dbUser!.id })

    return jsonResponse({ results }, 201)
  } catch (err) {
    logger.error('media-library', 'Medya yükleme hatası', err)
    return errorResponse('Medya yüklenemedi', 500)
  }
}
