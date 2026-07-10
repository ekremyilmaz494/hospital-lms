import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * POST /api/telemetry/client-error
 *
 * Client/React error-boundary backstop. Public — no auth (boundary hata login ekranında
 * veya auth bozukken de patlayabilir). Rate-limited (IP başına). DB yazımı YOK; sadece
 * structured `logger.error` ile container stdout'a yazar → `docker logs app`.
 *
 * NEDEN: error.tsx / global-error.tsx yalnız `Sentry.captureException` çağırıyor. Air-gap
 * on-prem'de Sentry DSN yok → no-op → beyaz-ekran/boundary çöküşü HİÇBİR YERDE görünmüyor.
 * Bu endpoint sunucu-tarafı görünürlük sağlar (Sentry-gate YOK; buluta da fazladan bir
 * yapılandırılmış log satırı düşer ama zararsız — cloud'da Sentry asıl kanal). Best-effort:
 * her yolda 204 döner; telemetri asla kullanıcıya hata göstermez.
 *
 * route.ts yalnız handler export eder (helper export'u `next build`'i kırar).
 */

const MAX_RAW_BYTES = 4096 // gövde sınırı — kötücül/kaçak istekler log'u şişirmesin
// Kontrol karakterleri (newline/CR dahil) — log-injection/satır-bölmeyi önlemek için temizlenir.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g // eslint-disable-line no-control-regex

/** Bilinmeyen değeri güvenli, kısaltılmış tek-satır string'e indirger. */
function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(CONTROL_CHARS, ' ').trim().slice(0, max)
}

const noContent = () => new NextResponse(null, { status: 204 })

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limit — IP başına 30/dk (crash-loop log-flood'unu sınırla) ──
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `client-error:${ip}`.replace(/[^a-zA-Z0-9:._@-]/g, '_')
    const allowed = await checkRateLimit(rateLimitKey, 30, 60)
    if (!allowed) return noContent() // sessizce düş — telemetri best-effort

    // ── Gövde: boyut sınırı + güvenli parse ──
    const raw = await request.text()
    if (raw.length > MAX_RAW_BYTES) return noContent()

    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return noContent()
    }
    if (typeof body !== 'object' || body === null) return noContent()

    const message = str(body.message, 500) || '(boş mesaj)'
    const digest = str(body.digest, 200)
    const url = str(body.url, 500)
    const stack = str(body.stack, 2000)
    const ua = str(request.headers.get('user-agent'), 200)

    logger.error('client-error', message, {
      digest: digest || null,
      url: url || null,
      stack: stack || null,
      ip,
      userAgent: ua || null,
    })

    return noContent()
  } catch {
    // Hiçbir hata boundary'ye geri sızmasın — her durumda 204.
    return noContent()
  }
}
