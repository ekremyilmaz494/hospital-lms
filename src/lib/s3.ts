import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSignedUrl as getCloudfrontSignedUrl } from '@aws-sdk/cloudfront-signer'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET = process.env.AWS_S3_BUCKET!

const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/aac',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
]

/** Generate presigned URL for uploading video to S3 */
export async function getUploadUrl(key: string, contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`İzin verilmeyen dosya türü: ${contentType}. Sadece video, PDF, PPTX ve ses dosyaları yüklenebilir.`)
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
  return url
}

/** Generate presigned URL for downloading from S3 (fallback if no CloudFront) */
export async function getDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })

  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

/** Generate CloudFront signed URL for video streaming */
export async function getStreamUrl(key: string) {
  const domain = process.env.AWS_CLOUDFRONT_DOMAIN
  const keyPairId = process.env.AWS_CLOUDFRONT_KEY_PAIR_ID
  const privateKey = process.env.AWS_CLOUDFRONT_PRIVATE_KEY

  const cfUrl = domain && !domain.includes('your-')
    ? `${domain.startsWith('http') ? domain : `https://${domain}`}/${key}`
    : null

  // CloudFront configured with signing keys → signed URL
  if (cfUrl && keyPairId && privateKey) {
    return getCloudfrontSignedUrl({
      url: cfUrl,
      keyPairId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      dateLessThan: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
  }

  // CloudFront configured but no signing keys → direct URL (public distribution)
  if (cfUrl) {
    return cfUrl
  }

  // No CloudFront at all → S3 presigned download URL
  return getDownloadUrl(key)
}

/** Delete object from S3 */
export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/** Upload a buffer directly to S3 (for server-side operations like backups) */
export async function uploadBuffer(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

/** Download an S3 object as Buffer (for server-side operations like restore) */
export async function downloadBuffer(key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }))

  if (!response.Body) {
    throw new Error(`S3 object body is empty: ${key}`)
  }

  const chunks: Uint8Array[] = []
  // @ts-expect-error -- S3 Body is a Readable stream in Node.js runtime
  for await (const chunk of response.Body) {
    chunks.push(chunk as Uint8Array)
  }
  return Buffer.concat(chunks)
}

/** Copy an S3 object to a new key (same bucket) */
export async function copyObject(sourceKey: string, destinationKey: string) {
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key: destinationKey,
  }))
}

/** Verify an S3 object exists and has size > 0. Returns content length in bytes or null if invalid. */
export async function verifyS3Object(key: string): Promise<number | null> {
  try {
    const response = await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }))
    const size = response.ContentLength ?? 0
    return size > 0 ? size : null
  } catch {
    return null
  }
}

/** Generate backup storage key */
export function backupKey(orgId: string) {
  return `backups/${orgId}/${Date.now()}.json`
}

const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp']

const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'ogg']
const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'pptx']
const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'aac']

/** Generate video storage key using a random UUID — avoids path traversal and filename guessing */
export function videoKey(orgId: string, trainingId: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    throw new Error(`İzin verilmeyen dosya uzantısı: .${ext}`)
  }
  const id = crypto.randomUUID()
  return `videos/${orgId}/${trainingId}/${id}.${ext}`
}

/** Generate document storage key (PDF, PPTX) */
export function documentKey(orgId: string, trainingId: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    throw new Error(`İzin verilmeyen dosya uzantısı: .${ext}`)
  }
  const id = crypto.randomUUID()
  return `documents/${orgId}/${trainingId}/${id}.${ext}`
}

/** Generate branding image storage key (logo, login banner) */
export function brandingKey(orgId: string, type: 'logo' | 'login-banner', filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`İzin verilmeyen dosya uzantısı: .${ext}`)
  }
  const id = crypto.randomUUID()
  return `branding/${orgId}/${type}/${id}.${ext}`
}

/** Generate audio storage key */
export function audioKey(orgId: string, trainingId: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    throw new Error(`İzin verilmeyen dosya uzantısı: .${ext}`)
  }
  const id = crypto.randomUUID()
  return `audio/${orgId}/${trainingId}/${id}.${ext}`
}
