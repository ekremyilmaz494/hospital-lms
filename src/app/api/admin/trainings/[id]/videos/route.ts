import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { getUploadUrl, videoKey, deleteObject } from '@/lib/s3'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const videos = await prisma.trainingVideo.findMany({
    where: { trainingId: id },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse(videos)
}

/** Get presigned upload URL */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!training) return errorResponse('Training not found', 404)

  const body = await parseBody<{
    filename: string
    contentType: string
    title: string
    description?: string
    durationSeconds: number
    sortOrder?: number
  }>(request)

  if (!body?.filename || !body?.contentType || !body?.title) {
    return errorResponse('filename, contentType, title required')
  }

  const key = videoKey(dbUser!.organizationId!, id, body.filename)

  // Get upload URL first — if S3 fails, no orphan DB record
  let uploadUrl: string
  try {
    uploadUrl = await getUploadUrl(key, body.contentType)
  } catch {
    return errorResponse('Video yükleme URL\'si alınamadı. S3 yapılandırmasını kontrol edin.', 503)
  }

  // Create video record only after successful upload URL
  const video = await prisma.trainingVideo.create({
    data: {
      trainingId: id,
      title: body.title,
      description: body.description,
      videoUrl: `${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`,
      videoKey: key,
      durationSeconds: body.durationSeconds,
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

  // Delete from S3
  await deleteObject(video.videoKey)

  // Delete from DB
  await prisma.trainingVideo.delete({ where: { id: videoId } })

  return jsonResponse({ success: true })
}
