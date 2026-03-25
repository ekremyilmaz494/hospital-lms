import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSignedUrl as getCloudfrontSignedUrl } from '@aws-sdk/cloudfront-signer'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET!

const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
]

/** Generate presigned URL for uploading video to S3 */
export async function getUploadUrl(key: string, contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`İzin verilmeyen dosya türü: ${contentType}. Sadece video dosyaları yüklenebilir.`)
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
export function getStreamUrl(key: string) {
  const domain = process.env.AWS_CLOUDFRONT_DOMAIN!
  const url = `${domain}/${key}`
  const keyPairId = process.env.AWS_CLOUDFRONT_KEY_PAIR_ID!
  const privateKey = process.env.AWS_CLOUDFRONT_PRIVATE_KEY!.replace(/\\n/g, '\n')

  return getCloudfrontSignedUrl({
    url,
    keyPairId,
    privateKey,
    dateLessThan: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
  })
}

/** Delete object from S3 */
export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/** Generate video storage key */
export function videoKey(orgId: string, trainingId: string, filename: string) {
  return `videos/${orgId}/${trainingId}/${Date.now()}-${filename}`
}
