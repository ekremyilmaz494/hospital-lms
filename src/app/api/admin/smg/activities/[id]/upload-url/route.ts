import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getUploadUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export const POST = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody<{ filename: string; contentType: string }>(request)
  if (!body || !body.filename || !body.contentType) {
    return errorResponse('filename ve contentType zorunludur', 400)
  }

  if (!ALLOWED_TYPES.includes(body.contentType)) {
    return errorResponse('Sadece PDF, JPEG ve PNG dosyaları yüklenebilir', 400)
  }

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!activity) return errorResponse('Aktivite bulunamadı', 404)

  const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const key = `smg/${organizationId}/${id}/${Date.now()}-${safeFilename}`

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

  await audit({
    action: 'UPDATE',
    entityType: 'SmgActivity',
    entityId: id,
    newData: { certificateUrl: key },
  })

  return jsonResponse({ uploadUrl, key }, 200, { 'Cache-Control': 'no-store' })
}, { requireOrganization: true })
