import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getScormUploadUrl, scormTmpKey, checkStorageQuota } from '@/lib/s3'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { SCORM_FEATURE_DISABLED_MSG, scormMaxPackageBytes, scormMaxPackageMb } from '@/lib/scorm/config'

/**
 * POST /api/admin/scorm/presign — SCORM .zip için presigned PUT URL üretir.
 * Zip Vercel fonksiyonundan GEÇMEZ (4.5MB limit) — doğrudan S3'e yüklenir; ardından
 * process endpoint'i (`/api/admin/scorm/upload`) indirir, açar ve çıkarır.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const enabled = await checkFeature(organizationId, 'scormSupport')
  if (!enabled) return errorResponse(SCORM_FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`scorm-presign:${dbUser.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = (await request.json()) as { fileName?: unknown; fileSize?: unknown }
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : 0

    if (!fileName.toLowerCase().endsWith('.zip')) {
      return errorResponse('Sadece .zip SCORM paketleri kabul edilir.', 400)
    }
    if (fileSize > scormMaxPackageBytes()) {
      return errorResponse(`Paket boyutu ${scormMaxPackageMb()}MB sınırını aşıyor.`, 400)
    }

    const quotaError = await checkStorageQuota(organizationId, fileSize)
    if (quotaError) return errorResponse(quotaError, 403)

    const tempKey = scormTmpKey(organizationId)
    const uploadUrl = await getScormUploadUrl(tempKey)
    return jsonResponse({ uploadUrl, tempKey })
  } catch (err) {
    logger.error('SCORM Presign', 'Presigned URL üretilemedi', err)
    return errorResponse('Yükleme URL’i oluşturulamadı', 400)
  }
}, { requireOrganization: true })
