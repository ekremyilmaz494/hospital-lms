import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getUploadUrl, videoKey, checkStorageQuota } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

/** Maximum file size: 500MB */
const MAX_FILE_SIZE = 500 * 1024 * 1024

/** Allowed video MIME types */
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/**
 * POST /api/upload/video
 * Presigned URL flow: client'a S3 presigned URL doner,
 * client dosyayi direkt S3'e yukler (Node.js memory'e girmez).
 *
 * Request body: { fileName: string, contentType: string, fileSize: number }
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // IP bazli rate limit: 10 upload / 1 saat
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await checkRateLimit(`upload:ip:${ip}`, 10, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Cok fazla yukleme islemi. Lutfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  try {
    const body = await request.json()
    const { fileName, contentType, fileSize } = body as { fileName?: string; contentType?: string; fileSize?: number }

    if (!fileName || !contentType) {
      return errorResponse('fileName ve contentType alanlari gerekli', 400)
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return errorResponse('Izin verilmeyen dosya turu. Sadece MP4, WebM ve QuickTime kabul edilir.', 400)
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return errorResponse('Dosya boyutu 500MB limitini asiyor', 400)
    }

    const organizationId = dbUser!.organizationId
    if (!organizationId) {
      return errorResponse('Kullanicinin organizasyon bilgisi bulunamadi', 403)
    }

    // Storage quota kontrolu
    const quotaError = await checkStorageQuota(organizationId, fileSize ?? 0)
    if (quotaError) return errorResponse(quotaError, 403)

    const key = videoKey(organizationId, 'drafts', fileName)
    const uploadUrl = await getUploadUrl(key, contentType)

    return jsonResponse({ uploadUrl, key, fileName, fileSize })
  } catch (err) {
    logger.error('Video Upload', 'Presigned URL olusturma hatasi', err)
    return errorResponse('Video yukleme baglantisi olusturulamadi', 500)
  }
}
