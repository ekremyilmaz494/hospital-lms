import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { s3 } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

const BUCKET = process.env.AWS_S3_BUCKET!

/** Map file extension to Content-Type */
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const types: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    xml: 'application/xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    swf: 'application/x-shockwave-flash',
    xsd: 'application/xml',
    dtd: 'application/xml-dtd',
  }
  return types[ext] ?? 'application/octet-stream'
}

/** GET /api/exam/[id]/scorm/content/[...path] — Serve SCORM package files */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id: trainingId, path: pathSegments } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      select: { scormManifestPath: true, organizationId: true },
    })

    if (!training || !training.scormManifestPath) {
      return errorResponse('SCORM içeriği bulunamadı', 404)
    }

    // Org isolation
    if (dbUser!.role !== 'super_admin' && training.organizationId !== dbUser!.organizationId) {
      return errorResponse('Bu içeriği görüntüleme yetkiniz yok', 403)
    }

    // Extract base path from manifest path (directory containing imsmanifest.xml)
    const basePath = training.scormManifestPath.replace(/\/[^/]+$/, '')
    const filePath = pathSegments.join('/')

    // Prevent path traversal
    if (filePath.includes('..')) {
      return errorResponse('Geçersiz dosya yolu', 400)
    }

    const s3Key = `${basePath}/${filePath}`

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    })

    const response = await s3.send(command)

    if (!response.Body) {
      return errorResponse('Dosya bulunamadı', 404)
    }

    // Convert S3 stream to buffer
    const chunks: Uint8Array[] = []
    const readable = response.Body as Readable
    for await (const chunk of readable) {
      chunks.push(chunk as Uint8Array)
    }
    const buffer = Buffer.concat(chunks)

    const contentType = getContentType(filePath)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    logger.error('SCORM Content', 'SCORM dosyasi sunulamadi', err)
    return errorResponse('SCORM icerigi yuklenemedi', 500)
  }
}
