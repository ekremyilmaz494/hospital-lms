/**
 * GET /api/admin/ai-content-studio/[id]/download — presigned download URL.
 *
 * 302 redirect yerine JSON döndürüyoruz; client window.location.href = url
 * ile yönlendirir → tarayıcı dosyayı indirir.
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getStreamUrl, getDownloadUrl } from '@/lib/s3'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const gen = await prisma.aiGeneration.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true, s3Key: true, mimeType: true, artifactType: true },
  })
  if (!gen) return errorResponse('Üretim bulunamadı.', 404)
  if (gen.status !== 'completed' || !gen.s3Key) {
    return errorResponse('Üretim henüz tamamlanmamış.', 409)
  }

  // Audio/video CloudFront stream URL avantajından yararlanır;
  // diğer tipler için S3 presigned download.
  const isStream = gen.artifactType === 'audio' || gen.artifactType === 'video'
  let url: string
  try {
    url = isStream ? await getStreamUrl(gen.s3Key) : await getDownloadUrl(gen.s3Key)
  } catch (err) {
    return errorResponse((err as Error).message ?? 'İndirme URL alınamadı.', 503)
  }

  return jsonResponse(
    { url, mimeType: gen.mimeType, expiresInSeconds: 3600 },
    200,
    { 'Cache-Control': 'private, no-store' },
  )
}, { requireOrganization: true })
