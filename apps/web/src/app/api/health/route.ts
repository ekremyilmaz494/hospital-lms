import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { s3 } from '@/lib/s3'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { isOnPrem } from '@/lib/deployment'
import { getLicenseState } from '@/lib/license/cache'

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

export async function GET(request: Request) {
  // Only reveal service details to authenticated monitoring requests
  const healthSecret = process.env.HEALTH_CHECK_SECRET
  const isAuthenticated = healthSecret &&
    request.headers.get('x-health-secret') === healthSecret

  if (!isAuthenticated) {
    // Public response: minimal — avoids leaking service topology
    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const services: Record<string, boolean> = {
    database: false,
    redis: false,
    auth: false,
    s3: false,
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
      await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      services.s3 = true
    }
  } catch { /* S3 check failed */ }

  // ── Config ref kontrolü ──
  // On-prem: müşteri kendi self-hosted Supabase'ine bağlanır — bulut proje
  // ref'i kontrolü anlamsızdır, her zaman eşleşmiş sayılır.
  const onprem = isOnPrem()
  const expectedRef = 'pkkkyyajfmusurcoovwt'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseRef = supabaseUrl.match(/\/\/([^.]+)\.supabase/)?.[1] ?? 'unknown'
  const refMatch = onprem || supabaseRef === expectedRef
  const dbUrl = process.env.DATABASE_URL ?? ''
  const dbRegion = dbUrl.match(/([a-z]{2}-[a-z]+-\d)/)?.[1] ?? 'unknown'

  // Yanlış projeye bağlıysa auth'u override et
  if (!refMatch) {
    services.auth = false
  }

  const critical = services.database && services.auth && refMatch
  const status = critical
    ? Object.values(services).every(Boolean) ? 'healthy' : 'degraded'
    : 'down'

  // On-prem: lisans durumunu da yansıt (monitör için).
  const license = onprem
    ? await (async () => {
        try {
          const s = await getLicenseState()
          return { state: s.state, daysToExpiry: s.daysToExpiry, offlineDaysLeft: s.offlineDaysLeft }
        } catch {
          return { state: 'unknown' }
        }
      })()
    : undefined

  return NextResponse.json(
    {
      status,
      services,
      config: {
        mode: onprem ? 'onprem' : 'cloud',
        supabaseRef,
        expectedRef: onprem ? null : expectedRef,
        refMatch,
        region: dbRegion,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
      },
      ...(license ? { license } : {}),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    },
    { status: status === 'down' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
