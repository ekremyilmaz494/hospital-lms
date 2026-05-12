import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createMultipart, videoKey, documentKey, audioKey, checkStorageQuota } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'

/**
 * POST /api/upload/multipart/create
 * Multipart upload başlatır — büyük dosyalar (>10MB) için tercih edilir.
 * UploadId + S3 key döner; sonrasında /sign ile parça URL'leri alınır.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const orgId = organizationId

  const allowed = await checkRateLimit(`presign:${dbUser.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = await request.json() as { fileName: string; contentType: string; trainingId?: string; accelerate?: boolean }
    const { fileName, contentType, trainingId, accelerate } = body

    if (!fileName || !contentType) {
      return errorResponse('fileName ve contentType gerekli', 400)
    }

    const quotaError = await checkStorageQuota(orgId)
    if (quotaError) return errorResponse(quotaError, 403)

    const tid = trainingId || 'drafts'

    let key: string
    if (contentType.startsWith('video/')) {
      key = videoKey(orgId, tid, fileName)
    } else if (contentType.startsWith('audio/')) {
      key = audioKey(orgId, tid, fileName)
    } else if (contentType === 'application/pdf' || contentType.includes('presentation')) {
      key = documentKey(orgId, tid, fileName)
    } else {
      return errorResponse('İzin verilmeyen dosya türü', 400)
    }

    const { uploadId } = await createMultipart(key, contentType, { accelerate: accelerate !== false })

    return jsonResponse({ uploadId, key, fileName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Multipart upload başlatılamadı'
    return errorResponse(msg, 400)
  }
}, { requireOrganization: true })
