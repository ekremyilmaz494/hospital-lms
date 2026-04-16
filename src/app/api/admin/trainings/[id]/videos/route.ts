import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { getUploadUrl, videoKey, documentKey, deleteObject, checkStorageQuota } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

// NOT: Bu dosyadaki await'ler ayrı endpoint handler'larında (GET/POST/DELETE);
// tek istek akışında en fazla 2 await çalışır. Promise.all bu bağımlı
// sıralı işlemler için uygun değil, bağımlılık zinciri var.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Multi-tenant guard: trainingId'nin admin'in organizasyonuna ait olduğunu
  // nested training.organizationId ile doğrula. Aksi halde başka hastanenin
  // training ID'si bilinirse videoları listelenebilir.
  const videos = await prisma.trainingVideo.findMany({
    where: {
      trainingId: id,
      training: { organizationId: dbUser!.organizationId! },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse(videos, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

/** Get presigned upload URL */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`upload:${dbUser!.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme işlemi. Lütfen bir saat bekleyin.', 429)

  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!training) return errorResponse('Training not found', 404)

  // Storage quota kontrolu
  const quotaError = await checkStorageQuota(dbUser!.organizationId!)
  if (quotaError) return errorResponse(quotaError, 403)

  const body = await parseBody<{
    filename: string
    contentType: string
    title: string
    description?: string
    durationSeconds: number
    sortOrder?: number
    mediaType?: 'video' | 'pdf'
    pageCount?: number
  }>(request)

  if (!body?.filename || !body?.contentType || !body?.title) {
    return errorResponse('filename, contentType, title required')
  }

  const mediaType = body.mediaType || 'video'
  const key = mediaType === 'pdf'
    ? documentKey(dbUser!.organizationId!, id, body.filename)
    : videoKey(dbUser!.organizationId!, id, body.filename)

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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'upload',
    entityType: 'training_video',
    entityId: video.id,
    newData: { title: body.title, key },
    request,
  })

  return jsonResponse({ uploadUrl, video }, 201)
}

/** Delete video */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return errorResponse('videoId required')

  // Verify training belongs to admin's organization
  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
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
    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: 'delete',
      entityType: 'training_video',
      entityId: video.id,
      oldData: { title: video.title, videoKey: video.videoKey },
      request,
    })

    return jsonResponse({ success: true })
  } catch (err) {
    logger.error('TrainingVideo:DELETE', 'Video silme hatası', err)
    return errorResponse('Video silinirken bir hata oluştu', 500)
  }
}
