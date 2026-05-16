import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { resolveContentLibraryUrl } from '@/lib/content-library-url'

/**
 * GET /api/admin/content-library/[id]/preview-url
 *
 * Admin önizleme modal'ı için kütüphane öğesinin signed URL'sini üretir.
 * Platform içerikleri (organizationId=NULL) tüm adminler tarafından izlenebilir;
 * kurum-özel içerikler yalnızca kendi adminleri tarafından.
 *
 * Cache-Control: 60s — signed URL 2 saat geçerli, kısa cache CDN kirletmez ve
 * yeni hover'larda yeni imza alınır.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const item = await prisma.contentLibrary.findFirst({
    where: {
      id,
      isActive: true,
      OR: [
        { organizationId: null },
        { organizationId },
      ],
    },
    select: { id: true, s3Key: true, contentType: true },
  })

  if (!item) {
    return errorResponse('İçerik bulunamadı veya erişim yetkiniz yok', 404)
  }

  if (!item.s3Key) {
    return errorResponse('Bu içerik için önizleme yok', 404)
  }

  const url = await resolveContentLibraryUrl(item)
  if (!url) {
    return errorResponse('İçerik şu anda yüklenemiyor', 503)
  }

  return jsonResponse(
    { url, contentType: item.contentType },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  )
}, { requireOrganization: true })
