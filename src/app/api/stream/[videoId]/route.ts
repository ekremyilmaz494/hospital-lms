import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, errorResponse } from '@/lib/api-helpers'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

/**
 * GET /api/stream/[videoId]
 * Proxy content from S3 — supports Range requests for video seeking,
 * and inline display for PDF documents.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const video = await prisma.trainingVideo.findFirst({
    where: { id: videoId },
    include: { training: { select: { organizationId: true } } },
  })

  if (!video) return errorResponse('İçerik bulunamadı', 404)
  if (video.training.organizationId !== dbUser!.organizationId) return errorResponse('Yetkisiz', 403)

  const key = video.videoKey || video.videoUrl
  if (!key || key.startsWith('/uploads')) {
    return errorResponse('Dosya S3\'te bulunamadı', 404)
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

    // Video streaming with Range support
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
  } catch {
    return errorResponse('İçerik stream hatası', 500)
  }
}
