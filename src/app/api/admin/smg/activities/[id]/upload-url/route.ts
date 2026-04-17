import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { getUploadUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const body = await parseBody<{ filename: string; contentType: string }>(request)
  if (!body || !body.filename || !body.contentType) {
    return errorResponse('filename ve contentType zorunludur', 400)
  }

  if (!ALLOWED_TYPES.includes(body.contentType)) {
    return errorResponse('Sadece PDF, JPEG ve PNG dosyaları yüklenebilir', 400)
  }

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    select: { id: true },
  })
  if (!activity) return errorResponse('Aktivite bulunamadı', 404)

  const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const key = `smg/${dbUser!.organizationId}/${id}/${Date.now()}-${safeFilename}`

  // DB güncellemesi presigned URL üretiminden önce yapılır.
  // Böylece DB hata verirse client'a asla kullanılacak URL verilmez
  // ve S3'te orphan key oluşma riski ortadan kalkar.
  try {
    await prisma.smgActivity.update({
      where: { id },
      data: { certificateUrl: key },
    })
  } catch (err) {
    logger.error('SmgUploadUrl', 'DB update failed', { activityId: id, err })
    return errorResponse('Sertifika kaydı güncellenemedi. Lütfen tekrar deneyin.', 500)
  }

  const uploadUrl = await getUploadUrl(key, body.contentType)

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'UPDATE',
    entityType: 'SmgActivity',
    entityId: id,
    newData: { certificateUrl: key },
    request,
  })

  return jsonResponse({ uploadUrl, key }, 200, { 'Cache-Control': 'no-store' })
}
