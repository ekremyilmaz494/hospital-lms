import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { getUploadUrl, videoKey } from '@/lib/s3'
import { logger } from '@/lib/logger'

/** Maximum file size: 5GB */
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024

/** Allowed video MIME types */
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

interface UploadRequestBody {
  fileName: string
  contentType: string
  fileSize: number
  trainingId: string
}

/**
 * POST /api/upload/video
 * Returns a presigned S3 URL for direct client-side video upload.
 * Client uploads the file directly to S3 using the returned URL.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  try {
    const body = await parseBody<UploadRequestBody>(request)

    if (!body || !body.fileName || !body.contentType || !body.fileSize || !body.trainingId) {
      return errorResponse('fileName, contentType, fileSize ve trainingId alanları zorunludur', 400)
    }

    const { fileName, contentType, fileSize, trainingId } = body

    if (!ALLOWED_TYPES.includes(contentType)) {
      return errorResponse(
        'İzin verilmeyen dosya türü. Sadece MP4, WebM ve QuickTime video dosyaları yüklenebilir.',
        400,
      )
    }

    // Dosya uzantısı kontrolü — MIME spoofing koruması
    const ALLOWED_EXTENSIONS = ['mp4', 'webm', 'mov']
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return errorResponse(
        'Geçersiz dosya uzantısı. Sadece .mp4, .webm ve .mov uzantıları kabul edilir.',
        400,
      )
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return errorResponse('Dosya boyutu 5GB limitini aşıyor', 400)
    }

    const organizationId = dbUser!.organizationId
    if (!organizationId) {
      return errorResponse('Kullanıcının organizasyon bilgisi bulunamadı', 403)
    }

    const key = videoKey(organizationId, trainingId, fileName)
    const uploadUrl = await getUploadUrl(key, contentType)

    return jsonResponse({
      uploadUrl,
      key,
      contentType,
      fileSize,
    })
  } catch (err) {
    logger.error('Video Upload', 'Presigned URL oluşturulurken hata', err)
    return errorResponse('Video yükleme URL\'si oluşturulurken bir hata oluştu', 500)
  }
}
