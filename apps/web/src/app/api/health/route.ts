import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { s3, s3Internal } from '@/lib/s3'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { isOnPrem } from '@/lib/deployment'
import { getServerSupabaseUrl } from '@/lib/supabase/onprem-config'
import { getLicenseState } from '@/lib/license/cache'

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

export async function GET(request: Request) {
  // Only reveal service details to authenticated monitoring requests
  const healthSecret = process.env.HEALTH_CHECK_SECRET
  const isAuthenticated = healthSecret &&
    request.headers.get('x-health-secret') === healthSecret

  if (!isAuthenticated) {
    // On-prem: Docker HEALTHCHECK bu (secret'sız) yolu çağırır. ESKİDEN KOŞULSUZ 200 dönerdi →
    // DB/servisler çökse bile konteyner 'healthy' görünür, restart:unless-stopped HİÇ tetiklenmezdi
    // (içi boş healthcheck). Artık hafif bir DB erişilebilirlik kontrolü yapar: app DB'ye ulaşamıyorsa
    // hiçbir şey servis edemez → 503 → healthcheck 'unhealthy' → restart. Topoloji sızdırmaz (yalnız
    // 200/503, ayrıntı yok). BULUT yolu DEĞİŞMEZ (minimal 200 — Vercel/monitör davranışı korunur).
    if (isOnPrem()) {
      try {
        await prisma.$queryRaw`SELECT 1`
      } catch (err) {
        logger.error('health', 'Public readiness DB kontrolu basarisiz', err)
        return NextResponse.json(
          { status: 'down', timestamp: new Date().toISOString() },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }
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
    // İÇ gateway URL'i (SUPABASE_URL=http://gateway:8000) — konteyner içinden. NEXT_PUBLIC_SUPABASE_URL
    // tarayıcı-yüzlü PUBLIC adrestir (on-prem'de PUBLIC_APP_URL); container içinden ona istek app'in
    // KENDİSİNE gider (/auth/v1 route'u yok → 404 → yanlış 'auth down'). getServerSupabaseUrl iç adresi verir.
    const url = getServerSupabaseUrl()
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
      // s3Internal (container→minio:9000) — public s3 client PUBLIC_STORAGE_URL'e (ör. localhost:9000)
      // bakar, container İÇİNDEN erişilemez → yanlış 's3 down'. Bulutta s3Internal null → s3'e düşer.
      await (s3Internal ?? s3).send(new HeadBucketCommand({ Bucket: bucket }))
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
