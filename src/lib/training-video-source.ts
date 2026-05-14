const MEDIA_KEY_RE = /^(videos|documents|audio)\/[^/]+\/.+$/i

type TrainingVideoSource = {
  id?: string
  videoKey?: string | null
  documentKey?: string | null
  videoUrl?: string | null
  contentType?: string | null
}

function cleanCandidate(value: string): string {
  return value.trim().replace(/^\/+/, '').split('?')[0].split('#')[0]
}

function stripBucketPrefix(pathname: string): string {
  const bucket = process.env.AWS_S3_BUCKET?.trim()
  if (!bucket) return pathname
  return pathname.startsWith(`${bucket}/`) ? pathname.slice(bucket.length + 1) : pathname
}

export function normalizeMediaObjectKey(value: string | null | undefined): string | null {
  if (!value) return null

  const raw = value.trim()
  if (!raw || raw.startsWith('/uploads') || raw.includes('..')) return null

  let key = raw
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    key = decodeURIComponent(url.pathname)
  } catch {
    // Plain S3 object key, not an absolute URL.
  }

  key = stripBucketPrefix(cleanCandidate(key))
  if (!key || key.includes('..') || !MEDIA_KEY_RE.test(key)) return null

  return key
}

export function resolveTrainingVideoObjectKey(video: TrainingVideoSource): string | null {
  const candidates = video.contentType === 'pdf'
    ? [video.documentKey, video.videoKey, video.videoUrl]
    : [video.videoKey, video.videoUrl]

  for (const candidate of candidates) {
    const key = normalizeMediaObjectKey(candidate)
    if (key) return key
  }

  return null
}

