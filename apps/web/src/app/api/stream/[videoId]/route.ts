import { prisma } from '@/lib/prisma'
import { withStaffRoute } from '@/lib/api-handler'
import { ApiError } from '@/lib/api-helpers'
import { s3 } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { logger } from '@/lib/logger'

/**
 * GET /api/stream/[videoId]
 * Proxy content from S3 — supports Range requests for video seeking,
 * and inline display for PDF documents.
 *
 * @deprecated Bu proxy route legacy `/uploads/...` path'leri için tutulur;
 *   yeni kayıtlar `resolveTrainingVideoUrl()` (lib/training-video-url.ts) ile
 *   doğrudan CloudFront signed URL alır. Bkz: CLAUDE.md "Video URL Kuralı".
 *   Commit `f74969c` staff exam akışını bu route'tan çıkardı (CDN'e taşıdı).
 */
export const GET = withStaffRoute<{ videoId: string }>(
  async ({ request, params, organizationId }) => {
    const { videoId } = params

    const video = await prisma.trainingVideo.findFirst({
      where: { id: videoId },
      include: { training: { select: { organizationId: true } } },
    })

    if (!video) throw new ApiError('İçerik bulunamadı', 404)
    if (video.training.organizationId !== organizationId) throw new ApiError('Yetkisiz', 403)

    // Canonical key kaynakları yalnız videoKey/documentKey. Ham `videoUrl`'ye
    // fallback YOK — upload artığıdır, S3 Key olarak kullanılırsa NoSuchKey üretir
    // (CLAUDE.md "Video URL Kuralı"; resolveTrainingVideoUrl de aynı sözleşmede).
    const key = video.videoKey || video.documentKey
    if (!key || key.startsWith('/uploads')) {
      throw new ApiError('Dosya S3\'te bulunamadı', 404)
    }

    const isPdf = video.contentType === 'pdf'
    const range = !isPdf ? request.headers.get('range') : null

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ...(range ? { Range: range } : {}),
    })

    try {
      const s3Response = await s3.send(command)

      if (isPdf) {
        const headers = new Headers({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=3600',
        })
        if (s3Response.ContentLength !== undefined) {
          headers.set('Content-Length', String(s3Response.ContentLength))
        }
        const stream = s3Response.Body as ReadableStream
        return new Response(stream as unknown as BodyInit, { status: 200, headers })
      }

      const headers = new Headers({
        'Content-Type': s3Response.ContentType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      })

      if (s3Response.ContentLength !== undefined) {
        headers.set('Content-Length', String(s3Response.ContentLength))
      }
      if (s3Response.ContentRange) {
        headers.set('Content-Range', s3Response.ContentRange)
      }

      const stream = s3Response.Body as ReadableStream
      return new Response(stream as unknown as BodyInit, {
        status: range ? 206 : 200,
        headers,
      })
    } catch (err) {
      const awsErr = err as { name?: string; $metadata?: { httpStatusCode?: number } }
      const code = awsErr.name ?? 'UnknownError'
      const httpStatus = awsErr.$metadata?.httpStatusCode

      logger.error('stream', `S3 stream hatasi: ${code}`, { videoId, key, httpStatus, error: (err as Error).message })

      if (code === 'NoSuchKey' || httpStatus === 404) {
        throw new ApiError('Dosya bulunamadi. Silinmis veya tasinmis olabilir.', 404)
      }
      if (code === 'AccessDenied' || httpStatus === 403) {
        throw new ApiError('Dosyaya erisim izni yok. Lutfen yoneticinize basin.', 403)
      }
      throw new ApiError('Icerik yuklenirken bir hata olustu. Lutfen tekrar deneyin.', 500)
    }
  },
  { requireOrganization: true },
)
