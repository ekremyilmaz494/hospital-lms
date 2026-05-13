import { getStreamUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

type TrainingVideoLike = {
  id: string
  videoKey: string | null
  videoUrl: string | null
  documentKey?: string | null
  contentType?: string | null
}

/**
 * Tek kaynak: TrainingVideo kaydından oynatılabilir signed URL üretir.
 *
 * Sözleşme:
 * - `videoKey` varsa → `getStreamUrl()` üzerinden signed CloudFront/S3 URL
 * - Legacy `/uploads/...` path'leri → raw `videoUrl` (S3 öncesi eski kayıtlar)
 * - Hata veya kaynak yok → `''` (boş string)
 *
 * KRİTİK: Ham `v.videoUrl`'ye (CloudFront raw URL) ASLA fallback YAPMAZ.
 * Bu fallback admin paneli videosunun 5-6 kez bozulup geri gelmesinin sebebiydi.
 * Bkz: CLAUDE.md "Video URL Kuralı".
 */
export async function resolveTrainingVideoUrl(v: TrainingVideoLike): Promise<string> {
  // Legacy /uploads path'leri: S3 öncesi yüklenen eski videolar
  if (v.videoUrl?.startsWith('/uploads')) return v.videoUrl

  if (!v.videoKey) return ''

  try {
    return await getStreamUrl(v.videoKey)
  } catch (err) {
    logger.error('training-video-url', 'getStreamUrl başarısız', {
      videoId: v.id,
      videoKey: v.videoKey,
      err,
    })
    return ''
  }
}

/**
 * Aynı sözleşme document (PDF) için. PDF eki documentKey field'ında tutulur.
 * Yoksa veya hata → ''.
 */
export async function resolveTrainingDocumentUrl(v: TrainingVideoLike): Promise<string> {
  if (!v.documentKey) return ''

  try {
    return await getStreamUrl(v.documentKey)
  } catch (err) {
    logger.error('training-video-url', 'document getStreamUrl başarısız', {
      videoId: v.id,
      documentKey: v.documentKey,
      err,
    })
    return ''
  }
}
