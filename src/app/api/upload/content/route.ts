import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { uploadBuffer, videoKey, documentKey, audioKey } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

/** Video: max 500MB, PDF/PPTX: max 100MB, Audio: max 200MB */
const MAX_VIDEO_SIZE = 500 * 1024 * 1024
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024
const MAX_AUDIO_SIZE = 200 * 1024 * 1024

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const DOCUMENT_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/aac']
const ALL_ALLOWED_TYPES = [...VIDEO_TYPES, ...DOCUMENT_TYPES, ...AUDIO_TYPES]

function detectContentType(mimeType: string): 'video' | 'pdf' | 'audio' {
  if (AUDIO_TYPES.includes(mimeType)) return 'audio'
  if (DOCUMENT_TYPES.includes(mimeType)) return 'pdf'
  return 'video'
}

/**
 * POST /api/upload/content
 * Genel içerik yükleme: video (MP4, WebM) veya PDF kabul eder.
 * Response: { key, fileName, fileSize, contentType }
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`upload:${dbUser!.id}`, 20, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme işlemi. Lütfen bir saat bekleyin.', 429)

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || !(file instanceof File)) {
      return errorResponse('Dosya gerekli', 400)
    }

    if (!ALL_ALLOWED_TYPES.includes(file.type)) {
      return errorResponse('İzin verilmeyen dosya türü. MP4, WebM, PDF, PPTX ve ses dosyaları (MP3, WAV, M4A, OGG, AAC) kabul edilir.', 400)
    }

    const contentType = detectContentType(file.type)
    const maxSize = contentType === 'video'
      ? MAX_VIDEO_SIZE
      : contentType === 'audio'
        ? MAX_AUDIO_SIZE
        : MAX_DOCUMENT_SIZE

    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024)
      return errorResponse(`Dosya boyutu ${limitMB}MB limitini aşıyor`, 400)
    }

    const organizationId = dbUser!.organizationId
    if (!organizationId) {
      return errorResponse('Kullanıcının organizasyon bilgisi bulunamadı', 403)
    }

    const key = contentType === 'video'
      ? videoKey(organizationId, 'drafts', file.name)
      : contentType === 'audio'
        ? audioKey(organizationId, 'drafts', file.name)
        : documentKey(organizationId, 'drafts', file.name)

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadBuffer(key, buffer, file.type)

    return jsonResponse({ key, fileName: file.name, fileSize: file.size, contentType })
  } catch (err) {
    logger.error('Content Upload', 'S3 yükleme hatası', err)
    return errorResponse('Dosya yüklenirken bir hata oluştu', 500)
  }
}
