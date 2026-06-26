import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse } from '@/lib/api-helpers';
import { withAdminRoute } from '@/lib/api-handler';
import { deleteObject } from '@/lib/s3';
import { checkRateLimit } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/admin/media-library/[id]
 *
 * Kütüphane öğesinin DB satırını HER ZAMAN siler (silme engeli YOK — kullanıcı kararı).
 *
 * S3 nesnesi referans-kontrollü: yalnızca bu `s3Key`'i kullanan hiçbir TrainingVideo
 * yoksa silinir. Kullanımdaki dosya asla silinmez → eğitimler çalışmaya devam eder.
 * (Eski sistemdeki 409 silme-engeli yerine bu sessiz-güvenli kural.)
 */
// perf-check: no-cache-invalidation — liste GET'i HTTP Cache-Control kullanır +
// revalidatePath('/admin/media-library') çağrılır; ayrı Redis cache yok.
export const DELETE = withAdminRoute<{ id: string }>(
  async ({ params, dbUser, organizationId, audit }) => {
    const allowed = await checkRateLimit(`media-library:delete:${dbUser.id}`, 20, 60);
    if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429);

    const { id } = params;

    try {
      const item = await prisma.mediaAsset.findUnique({
        where: { id },
        select: { id: true, title: true, organizationId: true, s3Key: true },
      });
      if (!item) return errorResponse('Medya bulunamadı', 404);

      // Tenant izolasyonu — yalnız kendi kurumunun öğesini silebilir.
      if (item.organizationId !== organizationId) {
        return errorResponse('Bu medya kurumunuza ait değil.', 403);
      }

      // S3 referans kontrolü: bu s3Key'i hâlâ kullanan TrainingVideo var mı?
      // Varsa S3 nesnesine DOKUNMA (eğitim çalışmaya devam etsin) — yalnız DB satırını sil.
      const usageCount = await prisma.trainingVideo.count({
        where: { videoKey: item.s3Key },
      });

      await prisma.mediaAsset.delete({ where: { id } });

      if (usageCount === 0) {
        // Hiçbir eğitim kullanmıyor → S3 nesnesini de temizle (deleteObject hata fırlatmaz).
        await deleteObject(item.s3Key);
      }

      await audit({
        action: 'media_asset.delete',
        entityType: 'media_asset',
        entityId: item.id,
        oldData: { title: item.title, s3Key: item.s3Key, s3Deleted: usageCount === 0 },
      });

      revalidatePath('/admin/media-library');

      return jsonResponse({ success: true, message: `"${item.title}" silindi` });
    } catch (err) {
      logger.error('MediaLibraryDelete', 'Medya silinemedi', err);
      return errorResponse('Medya silinirken hata oluştu', 500);
    }
  },
  { requireOrganization: true }
);
