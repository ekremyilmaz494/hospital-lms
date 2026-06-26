import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse } from '@/lib/api-helpers';
import { withAdminRoute } from '@/lib/api-handler';
import { resolveMediaAssetUrl } from '@/lib/media-asset-url';

/**
 * GET /api/admin/media-library/[id]/preview-url
 *
 * Admin önizleme modalı için imzalı (signed) oynatma URL'i üretir.
 * KRİTİK: Ham s3Key/URL döndürülmez — `resolveMediaAssetUrl` (getStreamUrl) üzerinden
 * geçer; başarısızsa '' döner (UI "İçerik yüklenemedi" gösterir).
 */
export const GET = withAdminRoute<{ id: string }>(
  async ({ params, organizationId }) => {
    const { id } = params;

    const item = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, organizationId: true, mediaType: true, s3Key: true },
    });
    if (!item || item.organizationId !== organizationId) {
      return errorResponse('Medya bulunamadı', 404);
    }

    const url = await resolveMediaAssetUrl(item);

    return jsonResponse({ url, mediaType: item.mediaType }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    });
  },
  { requireOrganization: true }
);
