import { prisma } from '@/lib/prisma'
import { getAuthUser, assertRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import nodemailer from 'nodemailer'

interface ServiceStatus {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTimeMs: number
  lastChecked: string
  message?: string
}

/** Servis saglik kontrolu suresi olcumu */
async function measureService(
  name: string,
  check: () => Promise<void>,
  degradedThresholdMs = 2000
): Promise<ServiceStatus> {
  const start = Date.now()
  const lastChecked = new Date().toISOString()

  try {
    await check()
    const responseTimeMs = Date.now() - start
    return {
      name,
      status: responseTimeMs > degradedThresholdMs ? 'degraded' : 'up',
      responseTimeMs,
      lastChecked,
    }
  } catch (err) {
    const responseTimeMs = Date.now() - start
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return {
      name,
      status: 'down',
      responseTimeMs,
      lastChecked,
      message,
    }
  }
}

/** PostgreSQL saglik kontrolu */
async function checkPostgreSQL(): Promise<ServiceStatus> {
  return measureService('PostgreSQL', async () => {
    await prisma.$queryRaw`SELECT 1`
  })
}

/** Redis saglik kontrolu */
async function checkRedis(): Promise<ServiceStatus> {
  return measureService('Redis', async () => {
    const redis = getRedis()
    if (!redis) {
      throw new Error('Redis yapilandirilmamis')
    }
    const result = await redis.ping()
    if (result !== 'PONG') {
      throw new Error(`Beklenmeyen PING yaniti: ${result}`)
    }
  })
}

/** S3 saglik kontrolu */
async function checkS3(): Promise<ServiceStatus> {
  return measureService('S3', async () => {
    const bucket = process.env.AWS_S3_BUCKET
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET yapilandirilmamis')
    }
    const s3 = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  })
}

/** SMTP saglik kontrolu */
async function checkSMTP(): Promise<ServiceStatus> {
  return measureService('SMTP', async () => {
    const host = process.env.SMTP_HOST
    if (!host) {
      throw new Error('SMTP_HOST yapilandirilmamis')
    }
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    await transporter.verify()
  })
}

/** Supabase Auth saglik kontrolu */
async function checkSupabaseAuth(): Promise<ServiceStatus> {
  return measureService('Supabase Auth', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL yapilandirilmamis')
    }
    const healthUrl = `${url}/auth/v1/health`
    const response = await fetch(healthUrl, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      throw new Error(`Supabase Auth HTTP ${response.status}`)
    }
  })
}

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  try {
    assertRole(dbUser!.role, ['super_admin'])
  } catch {
    return errorResponse('Forbidden', 403)
  }

  try {
    // Tum saglik kontrollerini paralel calistir
    const [postgresql, redis, s3, smtp, supabaseAuth] = await Promise.all([
      checkPostgreSQL(),
      checkRedis(),
      checkS3(),
      checkSMTP(),
      checkSupabaseAuth(),
    ])

    // Metrikler — DB zaten up oldugunu biliyoruz, guvenle sorgulayabiliriz
    let metrics = { activeUsers: 0, totalOrganizations: 0, totalUsers: 0 }

    if (postgresql.status !== 'down') {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

      const [totalOrganizations, totalUsers, activeUsersLogs] = await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        // Son 30 dk icinde islem yapan benzersiz kullanici sayisi (audit log uzerinden)
        prisma.auditLog.findMany({
          where: { createdAt: { gte: thirtyMinutesAgo }, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ])

      metrics = { activeUsers: activeUsersLogs.length, totalOrganizations, totalUsers }
    }

    return jsonResponse({
      services: [postgresql, redis, s3, smtp, supabaseAuth],
      metrics,
    })
  } catch (err) {
    logger.error('SystemHealth', 'Sistem saglik kontrolu basarisiz', err)
    return errorResponse('Sistem saglik kontrolu yapilamadi', 503)
  }
}
