import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getDownloadUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

const CONTENT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  json: 'application/json',
  png: 'image/png',
  csv: 'text/csv',
  md: 'text/markdown',
}

/** Artifact types that are served directly from contentData as JSON */
const JSON_ARTIFACT_TYPES = ['quiz', 'flashcards', 'mind_map', 'data_table']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { jobId } = await params

  const generation = await prisma.aiGeneration.findFirst({
    where: { id: jobId, organizationId: orgId },
  })

  if (!generation) {
    return errorResponse('Üretim bulunamadı', 404)
  }

  if (generation.status !== 'completed') {
    return errorResponse('İçerik henüz hazır değil', 425)
  }

  const { searchParams } = new URL(request.url)

  // Meta mode — return file metadata without streaming content
  if (searchParams.get('meta') === 'true') {
    return jsonResponse({
      url: `/api/admin/ai-content-studio/result/${jobId}`,
      artifactType: generation.artifactType,
      fileType: generation.outputFileType,
      fileSize: generation.outputSize,
      contentType:
        CONTENT_TYPE_MAP[generation.outputFileType || ''] ||
        'application/octet-stream',
    })
  }

  // Stream mode — return presigned S3 URL for direct browser streaming (audio/video)
  // S3 natively supports Range requests, enabling proper seek without proxy overhead
  if (searchParams.get('stream') === 'true' && generation.outputS3Key) {
    const streamUrl = await getDownloadUrl(generation.outputS3Key)
    return jsonResponse({ streamUrl })
  }

  // JSON shortcut — serve contentData directly for structured artifact types
  if (
    generation.contentData !== null &&
    JSON_ARTIFACT_TYPES.includes(generation.artifactType)
  ) {
    return new Response(JSON.stringify(generation.contentData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  // S3 download required
  if (!generation.outputS3Key) {
    return errorResponse('İçerik dosyası bulunamadı', 404)
  }

  let buffer: Uint8Array
  try {
    const downloadUrl = await getDownloadUrl(generation.outputS3Key)
    const s3Response = await fetch(downloadUrl)
    if (!s3Response.ok) {
      return errorResponse('Dosya indirilemedi', 502)
    }
    const arrayBuffer = await s3Response.arrayBuffer()
    buffer = new Uint8Array(arrayBuffer)
  } catch (err) {
    logger.error('ai-content-studio/result', 'S3 dosya indirme hatası', err)
    return errorResponse('Dosya indirilemedi', 502)
  }

  const contentType =
    CONTENT_TYPE_MAP[generation.outputFileType || ''] ||
    'application/octet-stream'

  // HTTP Range support for audio/video seeking
  const rangeHeader = request.headers.get('range')
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (match) {
      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1
      const chunk = buffer.subarray(start, end + 1)

      return new Response(chunk as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunk.length),
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }
  }

  // Full response
  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
