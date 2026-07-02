/**
 * Video transkript yardımcıları — AI soru üretimi kaynağı olarak kullanılan
 * otomatik transkriptlerin S3 key türetmesi ve durum çözümü.
 *
 * Kanonik kaynak S3'tür (DB değil): transkript pipeline'ı (lambda/video-transcoder
 * → MediaConvert audio output → lambda/video-transcribe → OpenRouter/Gemini)
 * videoKey'den DETERMİNİSTİK türetilen key ailesine yazar:
 *
 *   videoKey:  videos/{orgId}/{seg}/{uuid}(.mp4|_720p.mp4)  (seg = trainingId veya 'drafts')
 *   ses:       transcripts/{orgId}/{seg}/{uuid}.mp3          (başarıda silinir)
 *   metin:     transcripts/{orgId}/{seg}/{uuid}.txt
 *   kuyruk:    transcripts/{orgId}/{seg}/{uuid}.queued       (job yaratılınca yazılır)
 *   hata:      transcripts/{orgId}/{seg}/{uuid}.failed       (Türkçe hata mesajı içerir)
 *
 * Bu türetme sayesinde wizard draft videoları (henüz TrainingVideo satırı yok)
 * için de durum S3 HEAD'leriyle çözülebilir. `TrainingVideo.transcriptKey/Status`
 * kolonları yalnızca published satırlar için cache'tir (transcribe Lambda +
 * cron transcript backfill sweep yazar).
 */
import { verifyS3Object, s3ObjectExists } from '@/lib/s3'

export type TranscriptStatus = 'none' | 'processing' | 'completed' | 'failed'

export interface TranscriptResolution {
  status: TranscriptStatus
  /** status === 'completed' ise .txt key'i, değilse null */
  transcriptKey: string | null
  /** .txt dosyasının boyutu (byte) — completed dışı null */
  sizeBytes: number | null
}

// videoKey formatı: videos/{orgId}/{seg}/{uuid}[_720p].{ext}
// _720p son eki MediaConvert çıktısıdır — türetmede STRIP edilir ki ham key ile
// transcode-sonrası key aynı transkript ailesine işaret etsin.
const VIDEO_KEY_RE = /^videos\/([^/]+)\/([^/]+)\/([^/]+?)(_720p)?\.[a-zA-Z0-9]+$/

/**
 * videoKey'den transkript key ailesinin ortak tabanını türetir
 * (`transcripts/{orgId}/{seg}/{uuid}` — uzantısız). videoKey formata uymuyorsa null.
 */
export function deriveTranscriptBase(videoKey: string): string | null {
  if (typeof videoKey !== 'string' || videoKey.includes('..') || videoKey.includes('://')) {
    return null
  }
  const m = VIDEO_KEY_RE.exec(videoKey)
  if (!m) return null
  return `transcripts/${m[1]}/${m[2]}/${m[3]}`
}

/** videoKey'den transkript metin dosyasının key'ini türetir (yoksa null). */
export function deriveTranscriptTextKey(videoKey: string): string | null {
  const base = deriveTranscriptBase(videoKey)
  return base ? `${base}.txt` : null
}

/** Video silinirken temizlenmesi gereken tüm transkript kardeş key'leri. */
export function deriveTranscriptSiblingKeys(videoKey: string): string[] {
  const base = deriveTranscriptBase(videoKey)
  if (!base) return []
  return [`${base}.txt`, `${base}.mp3`, `${base}.queued`, `${base}.failed`]
}

/**
 * Transkript durumunu S3'ten çözer (draft videolar ve DB cache'i henüz
 * yazılmamış satırlar için). Öncelik: .txt → completed, .failed → failed,
 * .queued/.mp3 → processing, hiçbiri → none (özellik-öncesi video vb.).
 *
 * `.queued` marker'ı boş (0 byte) yazılır — verifyS3Object size>0 şartı
 * koyduğu için varlığı s3ObjectExists ile kontrol edilir.
 */
export async function resolveTranscriptStatus(videoKey: string): Promise<TranscriptResolution> {
  const base = deriveTranscriptBase(videoKey)
  if (!base) return { status: 'none', transcriptKey: null, sizeBytes: null }

  const [txtSize, failedExists, queuedExists, mp3Size] = await Promise.all([
    verifyS3Object(`${base}.txt`),
    s3ObjectExists(`${base}.failed`),
    s3ObjectExists(`${base}.queued`),
    verifyS3Object(`${base}.mp3`),
  ])

  if (txtSize !== null) {
    return { status: 'completed', transcriptKey: `${base}.txt`, sizeBytes: txtSize }
  }
  if (failedExists) return { status: 'failed', transcriptKey: null, sizeBytes: null }
  if (queuedExists || mp3Size !== null) {
    return { status: 'processing', transcriptKey: null, sizeBytes: null }
  }
  return { status: 'none', transcriptKey: null, sizeBytes: null }
}
