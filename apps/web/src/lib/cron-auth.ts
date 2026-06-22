import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Cron route'ları için sabit-zamanlı CRON_SECRET doğrulaması.
 * /api/cron/* middleware'de PUBLIC olduğundan her route kendi Bearer token kontrolünü yapar.
 * Düz `!==` karşılaştırması timing side-channel sızdırıyordu — crypto.timingSafeEqual ile kapatıldı.
 *
 * @returns null → yetkili (devam et); NextResponse(401/500) → reddet.
 */
export function assertCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET yapılandırılmamış' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const a = Buffer.from(authHeader)
  const b = Buffer.from(`Bearer ${cronSecret}`)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return null
}
