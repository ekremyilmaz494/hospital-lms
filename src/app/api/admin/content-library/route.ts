import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
} from '@/lib/api-helpers'
import { getUploadUrl, getStreamUrl, videoKey, documentKey, audioKey } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/content-library
 *
 * Kurumun erişebildiği aktif içerikler + isInstalled flag.
 * Platform içerikleri (organizationId = null) + kurumun kendi yüklediği içerikler.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {
    isActive: true,
    OR: [
      { organizationId: null },
      { organizationId: orgId },
    ],
  }
  if (category) where.category = category

  // İçerik listesi ve kurumun kurduğu içerik ID'lerini paralel çek
  const [items, installs] = await Promise.all([
    prisma.contentLibrary.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    }),
    prisma.organizationContentLibrary.findMany({
      where: { organizationId: orgId },
      select: { contentLibraryId: true },
    }),
  ])

  const installedSet = new Set(installs.map(i => i.contentLibraryId))

  // thumbnailUrl DB'de S3 key olarak saklanır; stream/signed URL'e çevir
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
        isOwned: item.organizationId === orgId,
      }
    }),
  )

  return jsonResponse({
    items: resolved,
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

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
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`content-library-upload:${dbUser!.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = await request.json() as {
      files: Array<{
        fileName: string
        contentType: string
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

    const results: Array<Record<string, unknown>> = []

    for (const file of body.files) {
      if (!file.fileName || !file.contentType) {
        results.push({ fileName: file.fileName, error: 'fileName ve contentType gerekli' })
        continue
      }

      // S3 key tayini
      let key: string
      let detectedType: string
      let detectedFileType: string
      try {
        if (file.contentType.startsWith('video/')) {
          key = videoKey(orgId, 'content-library', file.fileName)
          detectedType = 'video'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
        } else if (file.contentType.startsWith('audio/')) {
          key = audioKey(orgId, 'content-library', file.fileName)
          detectedType = 'audio'
          detectedFileType = file.fileName.split('.').pop()?.toLowerCase() ?? 'mp3'
        } else if (file.contentType === 'application/pdf' || file.contentType.includes('presentation')) {
          key = documentKey(orgId, 'content-library', file.fileName)
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

      const uploadUrl = await getUploadUrl(key, file.contentType)

      let thumbnailKey: string | null = null
      let thumbnailUploadUrl: string | null = null
      if (detectedType === 'video') {
        thumbnailKey = key.replace(/\.[^./]+$/, '') + '.thumb.jpg'
        thumbnailUploadUrl = await getUploadUrl(thumbnailKey, 'image/jpeg')
      }

      const title = file.title || file.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      const item = await prisma.contentLibrary.create({
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

    logger.info(
      'content-library',
      `${results.filter(r => !('error' in r)).length} içerik yüklendi`,
      { orgId, userId: dbUser!.id },
    )

    return jsonResponse({ results }, 201)
  } catch (err) {
    logger.error('content-library', 'İçerik yükleme hatası', err)
    return errorResponse('İçerik yüklenemedi', 500)
  }
}
