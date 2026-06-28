import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers';
import { withAdminRoute } from '@/lib/api-handler';
import { turkishSearchIds } from '@/lib/turkish-search';
import { getUploadUrl, videoKey, audioKey, getOrgStorageBytes } from '@/lib/s3';
import { checkRateLimit } from '@/lib/redis';
import { createMediaAssetSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/media-library
 *
 * Kurumun medya kütüphanesi — yüklediği video + ses dosyaları (org-scope).
 * `mediaType` filtresi (video|audio), arama, sayfalama. Eğitim sihirbazındaki
 * "Kütüphaneden Seç" picker'ı da bunu kullanır.
 */
export const GET = withAdminRoute(
  async ({ request, organizationId }) => {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('mediaType');
    const { page, limit, skip, search } = safePagination(searchParams, 500);

    const where: Record<string, unknown> = { organizationId };
    if (mediaType === 'video' || mediaType === 'audio') where.mediaType = mediaType;
    if (search) {
      where.id = { in: await turkishSearchIds('media_assets', ['title'], search) };
    }

    const [items, total, usageCounts] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          mediaType: true,
          // s3Key bilinçli olarak DÖNDÜRÜLMEZ: ham depolama key'i client'a sızmasın
          // (depolama düzeni açığa çıkar). Önizleme/seçim id üzerinden çözülür; eğitim
          // sihirbazı gerçek key'i sunucuda sourceMediaAssetId'den alır.
          durationSeconds: true,
          fileSizeBytes: true,
          createdAt: true,
        },
      }),
      prisma.mediaAsset.count({ where }),
      // Her asset kaç eğitimde kullanılıyor (soft back-ref) — silme uyarısı için.
      prisma.trainingVideo.groupBy({
        by: ['sourceMediaAssetId'],
        where: { sourceMediaAsset: { organizationId } },
        _count: { _all: true },
      }),
    ]);

    const usageMap = new Map(
      usageCounts
        .filter((u) => u.sourceMediaAssetId)
        .map((u) => [u.sourceMediaAssetId as string, u._count._all])
    );

    const resolved = items.map((item) => ({
      ...item,
      // BigInt JSON serileştirilemez — Number'a çevir (dosya boyutları güvenli aralıkta).
      fileSizeBytes: item.fileSizeBytes != null ? Number(item.fileSizeBytes) : null,
      usageCount: usageMap.get(item.id) ?? 0,
    }));

    return jsonResponse(
      { items: resolved, page, limit, total, totalPages: Math.ceil(total / limit) },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }
    );
  },
  { requireOrganization: true }
);

/**
 * POST /api/admin/media-library
 *
 * Kuruma yeni medya (video/ses) yükle — S3 presigned URL akışı:
 * 1) Her dosya için presign + media_assets kaydı (paralel, allSettled).
 * 2) Client dönen uploadUrl'e dosyayı PUT eder.
 * Yalnız video/audio kabul edilir (PDF/diğer reddedilir).
 */
// perf-check: no-cache-invalidation — liste GET'i Redis değil HTTP Cache-Control
// (max-age=30) kullanır; ayrı Redis cache yok, invalidateOrgCache gereksiz.
export const POST = withAdminRoute(
  async ({ request, dbUser, organizationId }) => {
    const allowed = await checkRateLimit(`media-library-upload:${dbUser.id}`, 30, 3600);
    if (!allowed) return errorResponse('Çok fazla yükleme isteği. Lütfen bekleyin.', 429);

    const body = await request.json().catch(() => null);
    const parsed = createMediaAssetSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Geçersiz veri', 400);
    const { files } = parsed.data;

    // Yalnız video/audio — kütüphane sadece bu iki türü barındırır.
    const unsupported = files.find(
      (f) => !f.contentType.startsWith('video/') && !f.contentType.startsWith('audio/')
    );
    if (unsupported) {
      return errorResponse(
        `Desteklenmeyen dosya türü: "${unsupported.fileName}". Yalnız video ve ses dosyaları yüklenebilir.`,
        400
      );
    }

    try {
      // Storage quota — toplam yüklenecek byte'ı önceden hesap et; limiti aşıyorsa
      // hiç presign etmeden 413 dön.
      const totalIncomingBytes = files.reduce((s, f) => s + Math.floor(f.fileSize), 0);
      const [subscription, usedBytes] = await Promise.all([
        prisma.organizationSubscription.findFirst({
          where: { organizationId },
          include: { plan: { select: { maxStorageGb: true } } },
        }),
        getOrgStorageBytes(organizationId),
      ]);
      const maxGb = subscription?.plan?.maxStorageGb ?? 10;
      const maxBytes = maxGb * 1024 * 1024 * 1024;
      if (usedBytes + totalIncomingBytes > maxBytes) {
        const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
        const incomingGb = (totalIncomingBytes / (1024 * 1024 * 1024)).toFixed(2);
        return errorResponse(
          `Depolama limitinizi aşıyor: ${usedGb}GB kullanılıyor + ${incomingGb}GB yüklenmek isteniyor (limit ${maxGb}GB). Planınızı yükseltin veya dosyalarınızı azaltın.`,
          413
        );
      }

      const settled = await Promise.allSettled(
        files.map(async (file) => {
          const isAudio = file.contentType.startsWith('audio/');
          const mediaType = isAudio ? 'audio' : 'video';
          const key = isAudio
            ? audioKey(organizationId, 'media-library', file.fileName)
            : videoKey(organizationId, 'media-library', file.fileName);

          const uploadUrl = await getUploadUrl(key, file.contentType);
          const title = file.title || file.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

          // (organizationId, s3Key) unique — nadir çakışmada Türkçe hata dön.
          let item: { id: string; title: string; mediaType: string; createdAt: Date };
          try {
            item = await prisma.mediaAsset.create({
              data: {
                organizationId,
                title,
                description: file.description ?? null,
                mediaType,
                s3Key: key,
                mimeType: file.contentType,
                durationSeconds: file.durationSeconds ?? null,
                fileSizeBytes: BigInt(Math.floor(file.fileSize)),
                uploadedById: dbUser.id,
              },
              select: { id: true, title: true, mediaType: true, createdAt: true },
            });
          } catch (createErr) {
            if ((createErr as { code?: string })?.code === 'P2002') {
              return { fileName: file.fileName, error: 'Bu dosya zaten kütüphanenizde mevcut' };
            }
            throw createErr;
          }

          return { ...item, uploadUrl, fileName: file.fileName };
        })
      );

      const results: Array<Record<string, unknown>> = settled.map((r, idx) =>
        r.status === 'fulfilled'
          ? (r.value as Record<string, unknown>)
          : {
              fileName: files[idx]?.fileName,
              error: (r.reason as Error)?.message ?? 'Bilinmeyen hata',
            }
      );

      logger.info(
        'media-library',
        `${results.filter((r) => !('error' in r)).length} medya yüklendi`,
        { orgId: organizationId, userId: dbUser.id }
      );

      return jsonResponse({ results }, 201);
    } catch (err) {
      logger.error('media-library', 'Medya yükleme hatası', err);
      return errorResponse('Medya yüklenemedi', 500);
    }
  },
  { requireOrganization: true }
);
