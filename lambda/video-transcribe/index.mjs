import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// hospital-lms-video-transcribe
// MediaConvert COMPLETE event'inin (mediaconvert-complete EventBridge kuralı,
// video-completion ile PARALEL 2. hedef) tetiklediği transkripsiyon Lambda'sı.
// Akış: transcripts/{...}.mp3 indir -> CBR byte-range chunk -> OpenRouter
// (Gemini 2.5 Flash, input_audio) -> transcripts/{...}.txt yaz -> DB'ye
// transcript_key/transcript_status PATCH (best-effort; draft'ta satır yoktur,
// cron transcript backfill sweep publish sonrası tamamlar).
//
// video-completion'a ZİNCİRLEME YAPMA: draft videolarda completion Lambda
// bilinçli throw eder (DB satırı yok) — zincir wizard akışında hiç ateşlenmezdi.

const REGION = process.env.AWS_REGION || 'eu-central-1'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'google/gemini-2.5-flash'

// 32kbps CBR mono MP3 = 4.000 byte/sn (transcoder'daki Mp3Settings ile kilitli).
// CBR olduğu için byte-range dilimleme süre-orantılıdır; MP3 frame'leri
// self-resync olduğundan dilim ortasından başlayan decoder toparlar (ffmpeg gerekmez).
const BYTES_PER_SEC = 4000
const CHUNK_SECONDS = Number(process.env.CHUNK_SECONDS) > 0 ? Number(process.env.CHUNK_SECONDS) : 1200 // 20 dk ≈ 4.8MB ham, ~6.4MB base64
const OVERLAP_SECONDS = 2 // dilim sınırında ~1 kelime tekrarı kabul edilebilir
const MAX_CHUNKS = 12 // ~4 saat üstü video -> .failed

const TRANSCRIBE_PROMPT =
  'Bu ses kaydını Türkçe olarak kelimesi kelimesine yazıya dök. ' +
  'İçerik hastane/sağlık eğitimi olabilir; tıbbi terimleri (dezenfeksiyon, sterilizasyon, ' +
  'enfeksiyon kontrolü, entübasyon, hijyen vb.) doğru yaz. ' +
  'Sadece transkript metnini döndür — zaman damgası, konuşmacı etiketi veya yorum ekleme.'

const s3 = new S3Client({ region: REGION })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function objectExists(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function downloadBuffer(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

async function putText(bucket, key, text, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: text,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  }))
}

async function deleteQuiet(bucket, key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (err) {
    console.error(`Failed to delete ${key}:`, err)
  }
}

/** CBR MP3 buffer'ını süre-orantılı byte-range dilimlerine böler. */
function splitCbrMp3(buffer) {
  const chunkBytes = CHUNK_SECONDS * BYTES_PER_SEC
  const overlapBytes = OVERLAP_SECONDS * BYTES_PER_SEC
  if (buffer.length <= chunkBytes) return [buffer]

  const chunks = []
  const step = chunkBytes - overlapBytes
  for (let start = 0; start < buffer.length; start += step) {
    chunks.push(buffer.subarray(start, Math.min(start + chunkBytes, buffer.length)))
    if (start + chunkBytes >= buffer.length) break
  }
  return chunks
}

/** Geçici (retry edilebilir) OpenRouter hatası mı? */
function isTransient(status) {
  return status === 429 || status >= 500
}

async function transcribeChunk(base64Audio, index, total) {
  const RETRY_DELAYS_MS = [0, 5000, 15000]
  let lastError = null

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt])

    let res
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://klinovax.com',
          'X-Title': 'KlinoVax LMS Transcribe',
        },
        body: JSON.stringify({
          model: TRANSCRIBE_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'input_audio', input_audio: { data: base64Audio, format: 'mp3' } },
              { type: 'text', text: TRANSCRIBE_PROMPT },
            ],
          }],
          temperature: 0,
        }),
        signal: AbortSignal.timeout(240_000),
      })
    } catch (err) {
      lastError = err
      console.error(`Chunk ${index + 1}/${total} network error (deneme ${attempt + 1}):`, err)
      continue
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      lastError = new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 500)}`)
      console.error(`Chunk ${index + 1}/${total} (deneme ${attempt + 1}):`, lastError.message)
      if (!isTransient(res.status)) throw lastError
      continue
    }

    const data = await res.json()
    // OpenRouter bazen HTTP 200 içinde error envelope döndürür — apps/web
    // openrouter.ts'teki pattern'in aynısı.
    if (data.error) {
      const code = Number(data.error.code) || 0
      lastError = new Error(`OpenRouter envelope error ${code}: ${data.error.message || 'unknown'}`)
      console.error(`Chunk ${index + 1}/${total} (deneme ${attempt + 1}):`, lastError.message)
      if (!isTransient(code)) throw lastError
      continue
    }

    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      lastError = new Error('OpenRouter response has no text content')
      continue
    }
    if (data.usage) {
      console.log(`Chunk ${index + 1}/${total} usage: ${JSON.stringify(data.usage)}`)
    }
    return content.trim()
  }

  throw lastError || new Error('Transcription failed after retries')
}

/**
 * transcript_key/transcript_status'u iki ardışık key denemesiyle PATCH'ler:
 * video-completion Lambda genelde önce koşup video_key'i _720p.mp4'e repoint
 * etmiştir (outputKey); yarışı kaybettiysek satır hâlâ ham key'tedir (sourceKey).
 * 0 eşleşme = draft (satır publish'te doğar) -> throw ETME, cron backfill halleder.
 */
async function patchVideoRecord(outputKey, sourceKey, transcriptKey, status) {
  const body = { transcript_key: transcriptKey, transcript_status: status }

  for (const matchKey of [outputKey, sourceKey]) {
    const url = `${SUPABASE_URL}/rest/v1/training_videos?video_key=eq.${encodeURIComponent(matchKey)}`
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
      console.error(`Supabase PATCH failed for ${matchKey}: ${res.status} ${await res.text().catch(() => '')}`)
      return 0
    }
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length > 0) return rows.length
  }

  console.log(`No DB match (draft?) for ${outputKey} / ${sourceKey} — cron backfill tamamlayacak`)
  return 0
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event))

  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY must be set')
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  const detail = event.detail
  if (!detail || detail.status !== 'COMPLETE') {
    console.log(`Skip non-complete event: status=${detail?.status}`)
    return { statusCode: 200, skipped: true }
  }

  const meta = detail.userMetadata || {}
  const { bucket, sourceKey, outputKey, audioKey } = meta

  // audioKey yoksa bu event eski (audio output'suz) bir job'dan geliyor — atla.
  if (!bucket || !audioKey) {
    console.log(`Skip event without audioKey metadata: ${JSON.stringify(meta)}`)
    return { statusCode: 200, skipped: true }
  }

  const baseKey = audioKey.replace(/\.mp3$/, '')
  const textKey = `${baseKey}.txt`
  const queuedKey = `${baseKey}.queued`
  const failedKey = `${baseKey}.failed`

  // İdempotency: EventBridge at-least-once teslim eder — .txt zaten varsa çık.
  if (await objectExists(bucket, textKey)) {
    console.log(`Transcript already exists: ${textKey}`)
    return { statusCode: 200, alreadyDone: true }
  }

  const fail = async (message) => {
    console.error(`Transcription failed for ${audioKey}: ${message}`)
    await putText(bucket, failedKey, message, 'text/plain; charset=utf-8')
    await deleteQuiet(bucket, audioKey)
    await deleteQuiet(bucket, queuedKey)
    await patchVideoRecord(outputKey || '', sourceKey || '', null, 'failed')
    return { statusCode: 200, failed: true, message }
  }

  let audio
  try {
    audio = await downloadBuffer(bucket, audioKey)
  } catch (err) {
    return fail(`Ses dosyası indirilemedi: ${err.message}`)
  }

  const chunks = splitCbrMp3(audio)
  console.log(`Audio ${audioKey}: ${audio.length} bytes -> ${chunks.length} chunk`)

  if (chunks.length > MAX_CHUNKS) {
    return fail('Video transkript için çok uzun (4 saat üstü).')
  }

  // Sıralı transkripsiyon: metin sırası korunur + OpenRouter rate limit'ine nazik.
  const parts = []
  for (let i = 0; i < chunks.length; i++) {
    try {
      parts.push(await transcribeChunk(chunks[i].toString('base64'), i, chunks.length))
    } catch (err) {
      return fail(`Transkripsiyon hatası (bölüm ${i + 1}/${chunks.length}): ${err.message}`)
    }
  }

  const transcript = parts.filter(Boolean).join('\n').trim()
  if (transcript.length < 50) {
    return fail('Videoda yazıya dökülebilir konuşma bulunamadı (sessiz veya yalnızca müzik olabilir).')
  }

  await putText(bucket, textKey, transcript, 'text/plain; charset=utf-8')
  console.log(`Transcript written: ${textKey} (${transcript.length} chars)`)

  await deleteQuiet(bucket, audioKey)
  await deleteQuiet(bucket, queuedKey)
  // Önceki bir deneme .failed bırakmışsa temizle — .txt artık kanonik durum.
  await deleteQuiet(bucket, failedKey)

  const dbMatched = await patchVideoRecord(outputKey || '', sourceKey || '', textKey, 'completed')

  return { statusCode: 200, textKey, chars: transcript.length, chunks: chunks.length, dbMatched }
}
