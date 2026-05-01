import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSignedUrl as getCloudfrontSignedUrl } from '@aws-sdk/cloudfront-signer'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export const s3 = new S3Client({
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
  // Belge ve metin kaynakları (içerik kütüphanesi)
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'application/rtf',
  'video/quicktime',
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

  const url = await getSignedUrl(s3, command, { expiresIn: 1800 })
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
    const formattedKey = privateKey.replace(/\\n/g, '\n')
    // PEM marker yoksa key bozuk; throw etmek yerine unsigned URL'e fallback (CloudFront public ise yine çalışır)
    if (!formattedKey.includes('BEGIN') || !formattedKey.includes('END')) {
      logger.warn('cf-key-invalid', 'AWS_CLOUDFRONT_PRIVATE_KEY PEM markerları içermiyor; unsigned URL kullanılıyor')
      return cfUrl
    }
    try {
      return getCloudfrontSignedUrl({
        url: cfUrl,
        keyPairId,
        privateKey: formattedKey,
        dateLessThan: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
    } catch (err) {
      logger.warn('cf-sign-failed', `CloudFront imzalama başarısız (${key}); unsigned URL'e fallback`, err)
      return cfUrl
    }
  }

  // CloudFront configured but no signing keys → direct URL (public distribution)
  if (cfUrl) {
    return cfUrl
  }

  // No CloudFront at all → S3 presigned download URL
  return getDownloadUrl(key)
}

/** Delete object from S3 — hata fırlatmaz, orphan key'i loglar */
export async function deleteObject(key: string) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (err) {
    logger.warn('s3-delete', `S3 silme basarisiz (orphan olabilir): ${key}`, err)
  }
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

/** Organizasyonun toplam storage kullanımını byte cinsinden hesapla */
export async function getOrgStorageBytes(orgId: string): Promise<number> {
  const result = await prisma.trainingVideo.aggregate({
    where: { training: { organizationId: orgId } },
    _sum: { fileSizeBytes: true },
  })
  return Number(result._sum.fileSizeBytes ?? 0)
}

/** Storage quota kontrolü — limit aşılmışsa hata mesajı döner, yoksa null */
export async function checkStorageQuota(orgId: string, additionalBytes = 0): Promise<string | null> {
  const subscription = await prisma.organizationSubscription.findFirst({
    where: { organizationId: orgId },
    include: { plan: { select: { maxStorageGb: true } } },
  })

  const maxBytes = (subscription?.plan?.maxStorageGb ?? 10) * 1024 * 1024 * 1024
  const usedBytes = await getOrgStorageBytes(orgId)

  if (usedBytes + additionalBytes > maxBytes) {
    const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1)
    const maxGb = subscription?.plan?.maxStorageGb ?? 10
    return `Depolama limitinize ulastiniz (${usedGb}GB / ${maxGb}GB). Plan yukseltmek icin yoneticinize basin.`
  }

  return null
}
