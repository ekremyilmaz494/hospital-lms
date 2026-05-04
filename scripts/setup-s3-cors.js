/**
 * S3 bucket CORS ayarı — browser direkt upload için zorunlu.
 * Çalıştır: node scripts/setup-s3-cors.js
 */
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

if (!BUCKET) {
  console.error('AWS_S3_BUCKET env eksik!')
  process.exit(1)
}

const origins = [
  APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length'],
      MaxAgeSeconds: 3600,
    },
  ],
}

async function main() {
  console.log(`Bucket: ${BUCKET}`)
  console.log(`İzin verilen origin'ler:`, origins)

  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: corsConfig,
  }))

  console.log('\n✅ CORS kuralları uygulandı.')

  const result = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }))
  console.log('\nMevcut CORS kuralları:')
  console.log(JSON.stringify(result.CORSRules, null, 2))
}

main().catch(err => {
  console.error('Hata:', err.message)
  process.exit(1)
})
