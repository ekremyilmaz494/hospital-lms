import { errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { s3, s3Internal } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { scormContentType } from '@/lib/scorm/mime'
import { sanitizeEntryPath } from '@/lib/scorm/extract'
import { checkFeature } from '@/lib/feature-gate'
import { SCORM_FEATURE_DISABLED_MSG } from '@/lib/scorm/config'

const BUCKET = process.env.AWS_S3_BUCKET!

/** GET /api/exam/[id]/scorm/content/[...path] — Serve SCORM package files (Range destekli) */
export const GET = withStaffRoute<{ id: string; path: string[] }>(async ({ request, params, dbUser, organizationId }) => {
  const { id: trainingId, path: pathSegments } = params

  try {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      select: { scormManifestPath: true, organizationId: true },
    })

    if (!training || !training.scormManifestPath) {
      return errorResponse('SCORM içeriği bulunamadı', 404)
    }

    // Org izolasyonu (super_admin muaf — önizleme).
    if (dbUser.role !== 'super_admin' && training.organizationId !== organizationId) {
      return errorResponse('Bu içeriği görüntüleme yetkiniz yok', 403)
    }

    // Feature gate — org'un planında SCORM kapalıysa içerik sunma.
    const enabled = await checkFeature(training.organizationId, 'scormSupport')
    if (!enabled) return errorResponse(SCORM_FEATURE_DISABLED_MSG, 403)

    // Atama sahipliği — org izolasyonu tek başına yetmez (IDOR): aynı org'daki ama
    // ATANMAMIŞ personel dosyaları çekemesin. Yalnız 'staff' için; admin/super_admin önizleyebilir.
    if (dbUser.role === 'staff') {
      const assignment = await prisma.trainingAssignment.findFirst({
        where: { trainingId, userId: dbUser.id },
        select: { id: true },
      })
      if (!assignment) {
        return errorResponse('Bu eğitim size atanmamış', 403)
      }
    }

    // Manifest dizini = base; istenen göreli yolu zip-slip'e karşı normalize et.
    const basePath = training.scormManifestPath.replace(/\/[^/]+$/, '')
    const safeRel = sanitizeEntryPath(pathSegments.join('/'))
    if (!safeRel) {
      return errorResponse('Geçersiz dosya yolu', 400)
    }
    const s3Key = `${basePath}/${safeRel}`

    // Range desteği: SCO gömülü mp4/mp3'ünde seek için 206 Partial Content.
    const rangeHeader = request.headers.get('range') ?? undefined
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    })

    const s3res = await (s3Internal ?? s3).send(command)
    if (!s3res.Body) {
      return errorResponse('Dosya bulunamadı', 404)
    }

    const webStream = s3res.Body.transformToWebStream()
    const headers: Record<string, string> = {
      'Content-Type': scormContentType(safeRel),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    }
    if (typeof s3res.ContentLength === 'number') {
      headers['Content-Length'] = String(s3res.ContentLength)
    }
    if (rangeHeader && s3res.ContentRange) {
      headers['Content-Range'] = s3res.ContentRange
      return new Response(webStream, { status: 206, headers })
    }
    return new Response(webStream, { status: 200, headers })
  } catch (err) {
    const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    if (httpStatus === 404) return errorResponse('Dosya bulunamadı', 404)
    if (httpStatus === 416) return errorResponse('Geçersiz aralık', 416)
    logger.error('SCORM Content', 'SCORM dosyasi sunulamadi', err)
    return errorResponse('SCORM icerigi yuklenemedi', 500)
  }
}, { requireOrganization: true })
