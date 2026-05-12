import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { abortMultipart, isValidS3KeyForOrg } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * POST /api/upload/multipart/abort
 * Multipart upload'ı iptal eder; S3'teki orphan parçaları temizler.
 * Best-effort: hata fırlatmaz, sadece loglar.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const body = await request.json() as { key: string; uploadId: string }
    const { key, uploadId } = body

    if (!key || !uploadId) {
      return errorResponse('key ve uploadId gerekli', 400)
    }
    if (!isValidS3KeyForOrg(key, organizationId)) {
      logger.warn('multipart-abort', 'Org dışı veya geçersiz S3 key reddedildi', { userId: dbUser.id, key: String(key).slice(0, 80) })
      return errorResponse('Geçersiz dosya referansı', 400)
    }

    await abortMultipart(key, uploadId)
    return jsonResponse({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Abort başarısız'
    return errorResponse(msg, 400)
  }
}, { requireOrganization: true })
