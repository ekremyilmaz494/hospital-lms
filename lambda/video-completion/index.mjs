import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'eu-central-1'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const s3 = new S3Client({ region: REGION })

async function getObjectSize(bucket, key) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  return res.ContentLength ?? 0
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function updateVideoRecord(sourceKey, newKey, newSizeBytes, durationSeconds) {
  const url = `${SUPABASE_URL}/rest/v1/training_videos?video_key=eq.${encodeURIComponent(sourceKey)}`

  // video_url'ye ASLA DOKUNMA — CLAUDE.md "Video URL Kuralı": kanonik kaynak
  // video_key'dir, frontend resolveTrainingVideoUrl ile her zaman videoKey'den
  // signed URL üretir. Buraya ham/unsigned CloudFront URL yazmak private
  // distribution'da 403 üretir (bu sorun 5-6 kez geri geldi — eski body bunu yapıyordu).
  const body = {
    video_key: newKey,
    file_size_bytes: newSizeBytes,
    // MediaConvert event'inden ölçülen süre — duration_seconds=0 kayıtlarını önler.
    ...(Number.isFinite(durationSeconds) && durationSeconds > 0
      ? { duration_seconds: durationSeconds }
      : {}),
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase update failed: ${res.status} ${text}`)
  }

  return res.json()
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event))

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  const detail = event.detail
  if (!detail || detail.status !== 'COMPLETE') {
    console.log(`Skip non-complete event: status=${detail?.status}`)
    return { statusCode: 200, skipped: true }
  }

  const meta = detail.userMetadata || {}
  const bucket = meta.bucket
  const sourceKey = meta.sourceKey
  const outputKey = meta.outputKey

  if (!bucket || !sourceKey || !outputKey) {
    throw new Error(`Missing user metadata: ${JSON.stringify(meta)}`)
  }

  const newSize = await getObjectSize(bucket, outputKey)
  console.log(`Transcoded output ${outputKey} size=${newSize} bytes`)

  // MediaConvert COMPLETE event'inden gerçek video süresini oku — duration_seconds=0
  // kayıtları (frontend'de 00:00 + anti-cheat watch-floor devre dışı) bir daha doğmasın.
  const durationMs =
    detail.outputGroupDetails?.[0]?.outputDetails?.[0]?.durationInMs
  const durationSeconds = Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : null
  console.log(`Measured duration: ${durationSeconds ?? 'n/a'}s`)

  // YARIŞ DURUMU: DB satırı upload event'inden SONRA (admin wizard'ı kaydedince)
  // oluşabilir; transcode bittiğinde satır henüz yokken match=0 olur ve eski kod
  // sessizce vazgeçiyordu (retry/sweep yok) → orphan: DB ham key'de kalır, mobilde
  // moov-atom-sonda "video yükleniyor" sonsuz döner (2026-06-11 Devakent incident).
  // Kısa backoff'lu retry race'in yaygın halini (satır saniyeler sonra oluşur) kapatır.
  let updated = null
  const RETRY_DELAYS_MS = [0, 3000, 8000]
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt])
    updated = await updateVideoRecord(sourceKey, outputKey, newSize, durationSeconds)
    if (Array.isArray(updated) && updated.length > 0) break
    console.log(`No DB match for video_key=${sourceKey} (deneme ${attempt + 1}/${RETRY_DELAYS_MS.length})`)
  }

  if (!Array.isArray(updated) || updated.length === 0) {
    // Hâlâ eşleşme yok: ya henüz kaydedilmemiş bir draft ya da key uyuşmazlığı.
    // Ham dosyayı KORU (silme — match başarılıyken silinir). throw ile EventBridge
    // retry / DLQ'ya düşür ki görünür olsun. BAĞIMSIZ BACKSTOP: apps/web cron/cleanup
    // "orphan transcode sweep" bu kaydı gün içinde S3'teki _720p'ye repoint eder.
    throw new Error(
      `No DB record matched video_key=${sourceKey} after ${RETRY_DELAYS_MS.length} attempts; original kept, cron sweep will backfill`,
    )
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }))
    console.log(`Deleted original ${sourceKey}`)
  } catch (err) {
    console.error(`Failed to delete original ${sourceKey}:`, err)
  }

  return { statusCode: 200, sourceKey, outputKey, newSize, durationSeconds, dbMatched: updated.length }
}
