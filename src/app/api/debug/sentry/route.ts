import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// Sentry kurulumunu test etmek icin — hem server hem client tarafini dogrular.
// GUVENLIK: Sadece development veya HEALTH_CHECK_SECRET header'i ile acilir.
// Prod'da rastgele erisim yok — aksi halde Sentry quota'yi sömürebilir.

export const dynamic = 'force-dynamic'

// Diagnostic endpoint — hiçbir şey cache'lenmemeli.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

export async function GET(request: Request) {
  const isDev = process.env.NODE_ENV === 'development'
  const secret = process.env.HEALTH_CHECK_SECRET
  const isAuthenticated = secret && request.headers.get('x-health-secret') === secret

  if (!isDev && !isAuthenticated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE_HEADERS })
  }

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') ?? 'message'

  const dsnConfigured = Boolean(process.env.SENTRY_DSN)
  const publicDsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

  if (!dsnConfigured) {
    return NextResponse.json(
      {
        ok: false,
        message: 'SENTRY_DSN tanimli degil — Sentry devre disi.',
        dsnConfigured,
        publicDsnConfigured,
      },
      { status: 503, headers: NO_CACHE_HEADERS },
    )
  }

  try {
    if (mode === 'error') {
      // Bu hata catch'lenir ama Sentry.captureException ile gonderilir
      throw new Error('Sentry debug test — server error (manuel tetiklendi)')
    }

    if (mode === 'unhandled') {
      // Bilincli olarak catch'lenmemis — Next.js onRequestError + captureRequestError yakalamali
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x: any = undefined
      return NextResponse.json({ value: x.boom.bang }, { headers: NO_CACHE_HEADERS })
    }

    // Default: captureMessage
    Sentry.captureMessage('Sentry debug test — server message (manuel tetiklendi)', 'info')
    await Sentry.flush(2000)

    return NextResponse.json({
      ok: true,
      mode,
      dsnConfigured,
      publicDsnConfigured,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      hint: 'mode=error veya mode=unhandled ile farkli yollari test et. Sentry Issues sekmesinde 1-2 dakikada gorunmeli.',
    }, { headers: NO_CACHE_HEADERS })
  } catch (err) {
    Sentry.captureException(err)
    await Sentry.flush(2000)
    return NextResponse.json({
      ok: true,
      mode,
      captured: 'exception',
      message: (err as Error).message,
    }, { headers: NO_CACHE_HEADERS })
  }
}
