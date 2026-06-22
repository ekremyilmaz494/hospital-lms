import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
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

// Transfer Acceleration enabled client — used for upload presigning only.
// Türkiye'den eu-central-1'e RTT yüksek; CloudFront edge'leri (İstanbul/Sofya)
// üzerinden upload AWS backbone'una taşınınca hissedilir hızlanma sağlar.
// Download/server-side operasyonlarda fark yok, sadece presigned PUT URL'lerinde kullanılır.
export const s3Accelerate = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  useAccelerateEndpoint: true,
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
  // SVG bilinçli olarak hariç: gömülü <script> ile servis edilince stored-XSS açar.
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

/**
 * Generate presigned URL for uploading video to S3.
 * `opts.accelerate=false` müşteri firewall'u *.s3-accelerate.amazonaws.com'u
 * blokluyorsa client tarafından fallback için kullanılır — standart regional
 * endpoint'e (~1.5-3x daha yavaş ama her zaman izinli) imza üretir.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  opts?: { accelerate?: boolean },
) {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`İzin verilmeyen dosya türü: ${contentType}. Sadece video, PDF, Office (Word/PowerPoint/Excel), ses ve görsel dosyaları yüklenebilir.`)
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const client = opts?.accelerate === false ? s3 : s3Accelerate
  const url = await getSignedUrl(client, command, { expiresIn: 1800 })
  return url
}

/**
 * Multipart upload — büyük dosyalar (>10 MB) için parça parça paralel yükleme.
 * Avantaj: single PUT'ta tek TCP bağlantısının throughput limitine takılmaz,
 * paralel parçalar aggregate bandwidth'i artırır.
 * Akış:
 *   1. createMultipart → uploadId
 *   2. signMultipartParts → her parça için presigned PUT URL
 *   3. Client paralel olarak PUT eder, her başarılı parça ETag döner
 *   4. completeMultipart → ETag listesiyle parçaları birleştir
 *   5. Hata/iptal: abortMultipart
 */
export async function createMultipart(
  key: string,
  contentType: string,
  opts?: { accelerate?: boolean },
) {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`İzin verilmeyen dosya türü: ${contentType}.`)
  }
  // Create/Complete/Abort sunucu↔S3 arası çalışır, client'ın network'üne bağlı değil;
  // yine de tutarlılık için aynı bucket addressing'i kullanılır. AcceleratedEndpoint
  // ve standart endpoint aynı bucket'a yazar, sadece DNS farklı.
  const client = opts?.accelerate === false ? s3 : s3Accelerate
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
  )
  if (!res.UploadId) throw new Error('Multipart upload başlatılamadı')
  return { uploadId: res.UploadId, key }
}

export async function signMultipartParts(
  key: string,
  uploadId: string,
  partNumbers: number[],
  opts?: { accelerate?: boolean },
) {
  const client = opts?.accelerate === false ? s3 : s3Accelerate
  const urls = await Promise.all(
    partNumbers.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })
      const url = await getSignedUrl(client, command, { expiresIn: 1800 })
      return { partNumber, url }
    }),
  )
  return urls
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  await s3Accelerate.send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  )
}

export async function abortMultipart(key: string, uploadId: string) {
  try {
    await s3Accelerate.send(
      new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }),
    )
  } catch (err) {
    logger.warn('s3-abort-multipart', `Multipart abort başarısız (orphan parça kalmış olabilir): ${key}`, err)
  }
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
    // PEM marker yoksa key bozuk; S3 presigned URL'e fallback (CloudFront private dist'i için unsigned URL 403 döner)
    if (!formattedKey.includes('BEGIN') || !formattedKey.includes('END')) {
      logger.warn('cf-key-invalid', 'AWS_CLOUDFRONT_PRIVATE_KEY PEM markerları içermiyor; S3 presigned URL kullanılıyor')
      return getDownloadUrl(key)
    }
    try {
      return getCloudfrontSignedUrl({
        url: cfUrl,
        keyPairId,
        privateKey: formattedKey,
        dateLessThan: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
    } catch (err) {
      logger.warn('cf-sign-failed', `CloudFront imzalama başarısız (${key}); S3 presigned URL'e fallback`, err)
      return getDownloadUrl(key)
    }
  }

  // CloudFront domain configured but signing keys eksik (lokal dev senaryosu) → S3 presigned URL.
  // CloudFront private distribution'da unsigned URL 403 döner; S3 presigned güvenli ve çalışır.
  // (Public CloudFront distribution kullanılıyorsa env'de keyPairId/privateKey hiç tanımlanmaz.)
  if (cfUrl) {
    return getDownloadUrl(key)
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

/**
 * Multipart sign/complete/abort gibi raw key kabul eden endpoint'lerde IDOR guard.
 * Key formatı `videos|documents|audio/{orgId}/{trainingId}/{uuid}.{ext}` —
 * çağıran admin'in orgId'si key'in 2. segmentine eşit olmalı, aksi halde başka
 * org'un (uploadId,key) çiftini ele geçirmiş bir kullanıcı imzalama/iptal/birleştirme
 * yapabilir. UploadId pratikte unguessable ama bu defense-in-depth.
 */
const _S3_KEY_RE = /^(videos|documents|audio)\/([^/]+)\/([^/]+)\/[^/]+\.[a-zA-Z0-9]+$/
export function isValidS3KeyForOrg(key: unknown, orgId: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false
  if (key.includes('://') || key.includes('..')) return false
  const m = _S3_KEY_RE.exec(key)
  if (!m) return false
  return m[2] === orgId
}

/** Generate backup storage key */
export function backupKey(orgId: string) {
  return `backups/${orgId}/${Date.now()}.json`
}

// 'svg' bilinçli olarak hariç: branding upload'ında stored-XSS (gömülü <script>) riski.
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'ogg']
// AI soru üretimi kaynakları: PDF + Office (Word/PowerPoint/Excel). Sunucu
// tarafında metne çevrilip (document-extractor) prompt'a gömülür.
const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'pptx', 'docx', 'xlsx']
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

/** Generate document storage key (PDF, PPTX, DOCX, XLSX) */
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

/** Organizasyonun toplam storage kullanımını byte cinsinden hesapla.
 *
 * İki kaynağı toplar:
 *  - trainingVideo.fileSizeBytes (Training'lere bağlı dosyalar)
 *  - contentLibrary.fileSizeBytes (kuruma özel kütüphane öğeleri)
 *
 * Kütüphaneden install edilen platform içerikleri (organizationId=NULL ile
 * yaratılan ContentLibrary kayıtları) bu org'a fiziksel kopyalama yapmadan
 * referans olarak kullanıldığı için quota'ya dahil edilmez — sadece bu kurumun
 * S3'e yüklediği nesneler sayılır.
 */
export async function getOrgStorageBytes(orgId: string): Promise<number> {
  const [videoAgg, libraryAgg] = await Promise.all([
    prisma.trainingVideo.aggregate({
      where: { training: { organizationId: orgId } },
      _sum: { fileSizeBytes: true },
    }),
    prisma.contentLibrary.aggregate({
      where: { organizationId: orgId },
      _sum: { fileSizeBytes: true },
    }),
  ])
  return Number(videoAgg._sum.fileSizeBytes ?? 0) + Number(libraryAgg._sum.fileSizeBytes ?? 0)
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
