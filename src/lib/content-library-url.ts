import { getStreamUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

type ContentLibraryItemLike = {
  id: string
  s3Key: string | null
  contentType: string | null
}

/**
 * ContentLibrary kaydından oynatılabilir signed URL üretir.
 *
 * Sözleşme (resolveTrainingVideoUrl ile aynı pattern):
 * - `s3Key` varsa → `getStreamUrl()` üzerinden signed CloudFront/S3 URL
 * - Yoksa veya hata → '' (boş string)
 *
 * KRİTİK: Ham CloudFront URL'ye ASLA fallback YAPMAZ. CLAUDE.md "Video URL Kuralı"
 * gereği unsigned CloudFront URL'leri 403 üretir; fallback bug'ı 5-6 kez tekrarladı.
 *
 * Kullanım yerleri:
 *  - `/api/admin/content-library/[id]/preview-url` — admin önizleme
 *  - Wizard "kütüphaneden seç" akışında preview
 */
export async function resolveContentLibraryUrl(item: ContentLibraryItemLike): Promise<string> {
  if (!item.s3Key) return ''

  try {
    return await getStreamUrl(item.s3Key)
  } catch (err) {
    logger.error('content-library-url', 'getStreamUrl başarısız', {
      itemId: item.id,
      s3Key: item.s3Key,
      err,
    })
    return ''
  }
}
