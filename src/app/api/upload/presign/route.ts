import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getUploadUrl, videoKey, documentKey, audioKey, checkStorageQuota } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'

/**
 * POST /api/upload/presign
 * Client-side upload için presigned URL üretir.
 * Dosya Vercel'e gönderilmez — doğrudan S3'e yüklenir.
 * Bu sayede Vercel'in 4.5MB body limitini aşar.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organizasyon bulunamadı', 403)

  const allowed = await checkRateLimit(`presign:${dbUser!.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429)

  try {
    const body = await request.json() as { fileName: string; contentType: string; trainingId?: string }
    const { fileName, contentType, trainingId } = body

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
    } else if (contentType === 'application/pdf' || contentType.includes('presentation')) {
      key = documentKey(orgId, tid, fileName)
    } else {
      return errorResponse('İzin verilmeyen dosya türü', 400)
    }

    const uploadUrl = await getUploadUrl(key, contentType)

    return jsonResponse({ uploadUrl, key, fileName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Presigned URL oluşturulamadı'
    return errorResponse(msg, 400)
  }
}
