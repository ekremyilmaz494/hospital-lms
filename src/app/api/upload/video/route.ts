import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { uploadBuffer, videoKey } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

/** Maximum file size: 500MB (server-side upload) */
const MAX_FILE_SIZE = 500 * 1024 * 1024

/** Allowed video MIME types */
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/**
 * POST /api/upload/video
 * Server-side video upload: receives FormData with file, uploads to S3.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // IP bazlı rate limit: 10 upload / 1 saat
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await checkRateLimit(`upload:ip:${ip}`, 10, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla yükleme işlemi. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || !(file instanceof File)) {
      return errorResponse('Video dosyası gerekli', 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse('İzin verilmeyen dosya türü. Sadece MP4, WebM ve QuickTime kabul edilir.', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('Dosya boyutu 500MB limitini aşıyor', 400)
    }

    const organizationId = dbUser!.organizationId
    if (!organizationId) {
      return errorResponse('Kullanıcının organizasyon bilgisi bulunamadı', 403)
    }

    const key = videoKey(organizationId, 'drafts', file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadBuffer(key, buffer, file.type)

    return jsonResponse({ key, fileName: file.name, fileSize: file.size })
  } catch (err) {
    logger.error('Video Upload', 'S3 yükleme hatası', err)
    return errorResponse('Video yüklenirken bir hata oluştu', 500)
  }
}
