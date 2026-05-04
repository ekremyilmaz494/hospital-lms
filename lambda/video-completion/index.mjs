import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'eu-central-1'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN

const s3 = new S3Client({ region: REGION })

async function getObjectSize(bucket, key) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  return res.ContentLength ?? 0
}

async function updateVideoRecord(sourceKey, newKey, newSizeBytes) {
  const url = `${SUPABASE_URL}/rest/v1/training_videos?video_key=eq.${encodeURIComponent(sourceKey)}`
  const newVideoUrl = CLOUDFRONT_DOMAIN
    ? `${CLOUDFRONT_DOMAIN.startsWith('http') ? CLOUDFRONT_DOMAIN : `https://${CLOUDFRONT_DOMAIN}`}/${newKey}`
    : null

  const body = {
    video_key: newKey,
    file_size_bytes: newSizeBytes,
    ...(newVideoUrl ? { video_url: newVideoUrl } : {}),
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

  const updated = await updateVideoRecord(sourceKey, outputKey, newSize)
  console.log(`DB updated rows: ${Array.isArray(updated) ? updated.length : 'unknown'}`)

  if (!Array.isArray(updated) || updated.length === 0) {
    console.log(`No DB record matched video_key=${sourceKey}. Keeping original (likely an unsaved draft upload). Will retry on next upload event or manual sweep.`)
    return { statusCode: 200, sourceKey, outputKey, newSize, dbMatched: 0, originalKept: true }
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }))
    console.log(`Deleted original ${sourceKey}`)
  } catch (err) {
    console.error(`Failed to delete original ${sourceKey}:`, err)
  }

  return { statusCode: 200, sourceKey, outputKey, newSize, dbMatched: updated.length }
}
