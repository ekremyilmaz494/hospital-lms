/**
 * GET /api/admin/ai-content-studio/[id]/download — presigned download URL.
 *
 * 302 redirect yerine JSON döndürüyoruz; client window.location.href = url
 * ile yönlendirir → tarayıcı dosyayı indirir.
 */
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getStreamUrl, getDownloadUrl } from '@/lib/s3'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const gen = await prisma.aiGeneration.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
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
}
