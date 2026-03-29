import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

export async function GET() {
  const services: Record<string, boolean> = {
    database: false,
    redis: false,
    auth: false,
    s3: false,
    smtp: false,
  }

  // ── DB check ──
  try {
    await prisma.$queryRaw`SELECT 1`
    services.database = true
  } catch (err) {
    logger.error('health', 'DB baglanti hatasi', err)
  }

  // ── Redis check ──
  try {
    const redis = getRedis()
    if (redis) {
      await redis.set('health:ping', 'pong', { ex: 10 })
      const val = await redis.get<string>('health:ping')
      services.redis = val === 'pong'
    }
  } catch (err) {
    logger.error('health', 'Redis baglanti hatasi', err)
  }

  // ── Supabase Auth check ──
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(5000),
      })
      services.auth = res.ok
    }
  } catch { /* auth check failed */ }

  // ── S3 check ──
  try {
    const bucket = process.env.AWS_S3_BUCKET
    const region = process.env.AWS_REGION
    if (bucket && region && process.env.AWS_ACCESS_KEY_ID) {
      const s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
      await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      services.s3 = true
    }
  } catch { /* S3 check failed */ }

  // ── SMTP check (actual connection verify) ──
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 5000,
      })
      await transporter.verify()
      services.smtp = true
    }
  } catch { /* SMTP check failed */ }

  const critical = services.database && services.auth
  const status = critical
    ? Object.values(services).every(Boolean) ? 'healthy' : 'degraded'
    : 'down'

  return NextResponse.json(
    {
      status,
      services,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    },
    { status: status === 'down' ? 503 : 200 },
  )
}
