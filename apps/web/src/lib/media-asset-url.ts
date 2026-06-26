import { getStreamUrl } from '@/lib/s3';
import { logger } from '@/lib/logger';

type MediaAssetLike = {
  id: string;
  s3Key: string | null;
};

/**
 * Tek kaynak: MediaAsset kaydından oynatılabilir signed URL üretir.
 *
 * Sözleşme:
 * - `s3Key` varsa → `getStreamUrl()` üzerinden signed CloudFront/S3 URL
 * - Kaynak yok veya hata → `''` (boş string)
 *
 * KRİTİK: Ham `s3Key`/URL'ye ASLA fallback YAPMAZ — `resolveTrainingVideoUrl`
 * ile aynı sözleşme. CloudFront private distribution'da unsigned URL 403 üretir.
 * Bkz: CLAUDE.md "Video URL Kuralı". perf-check `raw-video-url` kuralı bunu korur.
 */
export async function resolveMediaAssetUrl(asset: MediaAssetLike): Promise<string> {
  if (!asset.s3Key) return '';

  try {
    return await getStreamUrl(asset.s3Key);
  } catch (err) {
    logger.error('media-asset-url', 'getStreamUrl başarısız', {
      assetId: asset.id,
      s3Key: asset.s3Key,
      err,
    });
    return '';
  }
}
