import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { completeMultipart, isValidS3KeyForOrg } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * POST /api/upload/multipart/complete
 * Yüklenen parçaları S3'te birleştirir.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const body = await request.json() as {
      key: string
      uploadId: string
      parts: { partNumber: number; etag: string }[]
    }
    const { key, uploadId, parts } = body

    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return errorResponse('key, uploadId ve parts gerekli', 400)
    }
    if (!isValidS3KeyForOrg(key, organizationId)) {
      logger.warn('multipart-complete', 'Org dışı veya geçersiz S3 key reddedildi', { userId: dbUser.id, key: String(key).slice(0, 80) })
      return errorResponse('Geçersiz dosya referansı', 400)
    }
    if (parts.some(p => !p.etag || typeof p.partNumber !== 'number')) {
      return errorResponse('Her parça için partNumber ve etag gerekli', 400)
    }

    await completeMultipart(key, uploadId, parts)
    return jsonResponse({ ok: true, key })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Multipart tamamlanamadı'
    return errorResponse(msg, 400)
  }
}, { requireOrganization: true })
