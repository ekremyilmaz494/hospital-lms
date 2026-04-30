import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getUploadUrl, videoKey, documentKey, deleteObject, checkStorageQuota } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

// NOT: Bu dosyadaki await'ler ayrı endpoint handler'larında (GET/POST/DELETE);
// tek istek akışında en fazla 2 await çalışır. Promise.all bu bağımlı
// sıralı işlemler için uygun değil, bağımlılık zinciri var.

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  // Multi-tenant guard: trainingId'nin admin'in organizasyonuna ait olduğunu
  // nested training.organizationId ile doğrula. Aksi halde başka hastanenin
  // training ID'si bilinirse videoları listelenebilir.
  const videos = await prisma.trainingVideo.findMany({
    where: {
      trainingId: id,
      training: { organizationId: organizationId },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse(videos, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

/** Get presigned upload URL */
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`upload:${dbUser.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme işlemi. Lütfen bir saat bekleyin.', 429)

  const training = await prisma.training.findFirst({ where: { id, organizationId: organizationId } })
  if (!training) return errorResponse('Training not found', 404)

  // Storage quota kontrolu
  const quotaError = await checkStorageQuota(organizationId)
  if (quotaError) return errorResponse(quotaError, 403)

  const body = await parseBody<{
    filename: string
    contentType: string
    title: string
    description?: string
    durationSeconds: number
    sortOrder?: number
    mediaType?: 'video' | 'pdf' | 'audio'
    pageCount?: number
  }>(request)

  if (!body?.filename || !body?.contentType || !body?.title) {
    return errorResponse('filename, contentType, title required')
  }

  const mediaType = body.mediaType || 'video'

  const allowedContentTypes: Record<'video' | 'pdf' | 'audio', RegExp> = {
    video: /^video\/(mp4|webm|quicktime|x-matroska|ogg)$/i,
    pdf: /^application\/pdf$/i,
    audio: /^audio\/(mpeg|mp4|mp3|ogg|wav|webm|x-m4a|aac)$/i,
  }
  const allowedRe = allowedContentTypes[mediaType as 'video' | 'pdf' | 'audio']
  if (!allowedRe || !allowedRe.test(body.contentType)) {
    return errorResponse('Desteklenmeyen dosya tipi. Yalnızca video, PDF ve ses dosyaları yüklenebilir.', 400)
  }

  const key = mediaType === 'pdf'
    ? documentKey(organizationId, id, body.filename)
    : videoKey(organizationId, id, body.filename)

  // Get upload URL first — if S3 fails, no orphan DB record
  let uploadUrl: string
  try {
    uploadUrl = await getUploadUrl(key, body.contentType)
  } catch {
    return errorResponse('Dosya yükleme URL\'si alınamadı. S3 yapılandırmasını kontrol edin.', 503)
  }

  // Create record only after successful upload URL
  const video = await prisma.trainingVideo.create({
    data: {
      trainingId: id,
      title: body.title,
      description: body.description,
      videoUrl: mediaType === 'video' ? `${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}` : key,
      videoKey: key,
      durationSeconds: body.durationSeconds,
      contentType: mediaType,
      pageCount: body.pageCount ?? null,
      sortOrder: body.sortOrder ?? 0,
    },
  })

  await audit({
    action: 'upload',
    entityType: 'training_video',
    entityId: video.id,
    newData: { title: body.title, key },
  })

  return jsonResponse({ uploadUrl, video }, 201)
}, { requireOrganization: true })

/** Delete video */
export const DELETE = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return errorResponse('videoId required')

  // Verify training belongs to admin's organization
  const training = await prisma.training.findFirst({ where: { id, organizationId: organizationId } })
  if (!training) return errorResponse('Training not found', 404)

  const video = await prisma.trainingVideo.findFirst({
    where: { id: videoId, trainingId: id },
  })
  if (!video) return errorResponse('Video not found', 404)

  try {
    // 1. Önce DB sil (multi-tenant güvenli: trainingId üzerinden org doğrulanmış)
    const delResult = await prisma.trainingVideo.deleteMany({ where: { id: videoId, trainingId: id } })
    if (delResult.count === 0) return errorResponse('Video bulunamadi veya yetkiniz yok', 404)

    // 2. Sonra S3 sil (best-effort; orphan nesneler cron ile temizlenebilir)
    try {
      await deleteObject(video.videoKey)
    } catch (s3Err) {
      logger.error('TrainingVideo:DELETE', 'S3 silme başarısız, orphan object kalabilir', {
        videoId,
        videoKey: video.videoKey,
        error: s3Err,
      })
    }

    // 3. Audit log (KVKK uyumluluğu)
    await audit({
      action: 'delete',
      entityType: 'training_video',
      entityId: video.id,
      oldData: { title: video.title, videoKey: video.videoKey },
    })

    return jsonResponse({ success: true })
  } catch (err) {
    logger.error('TrainingVideo:DELETE', 'Video silme hatası', err)
    return errorResponse('Video silinirken bir hata oluştu', 500)
  }
}, { requireOrganization: true })
