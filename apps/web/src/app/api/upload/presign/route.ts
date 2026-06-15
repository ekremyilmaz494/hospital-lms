import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getUploadUrl, videoKey, documentKey, audioKey, checkStorageQuota } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'

/**
 * POST /api/upload/presign
 * Client-side upload için presigned URL üretir.
 * Dosya Vercel'e gönderilmez — doğrudan S3'e yüklenir.
 * Bu sayede Vercel'in 4.5MB body limitini aşar.
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

    // Storage quota kontrolu
    const quotaError = await checkStorageQuota(orgId)
    if (quotaError) return errorResponse(quotaError, 403)

    const tid = trainingId || 'drafts'

    // Dosya türüne göre S3 key oluştur
    let key: string
    if (contentType.startsWith('video/')) {
      key = videoKey(orgId, tid, fileName)
    } else if (contentType.startsWith('audio/')) {
      key = audioKey(orgId, tid, fileName)
    } else if (
      contentType === 'application/pdf' ||
      contentType.includes('presentation') || // PPTX (...presentationml.presentation)
      contentType.includes('wordprocessing') || // DOCX (...wordprocessingml.document)
      contentType.includes('spreadsheet') // XLSX (...spreadsheetml.sheet)
    ) {
      // AI soru üretimi kaynakları: PDF + Office (Word/PowerPoint/Excel).
      key = documentKey(orgId, tid, fileName)
    } else {
      return errorResponse('İzin verilmeyen dosya türü', 400)
    }

    const uploadUrl = await getUploadUrl(key, contentType, { accelerate: accelerate !== false })

    return jsonResponse({ uploadUrl, key, fileName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Presigned URL oluşturulamadı'
    return errorResponse(msg, 400)
  }
}, { requireOrganization: true })
