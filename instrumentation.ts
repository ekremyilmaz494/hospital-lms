/**
 * Next.js instrumentation hook. Sentry'i dev'de yüklememek için tüm Sentry
 * import'ları dinamik yapılmıştır — aksi halde `@sentry/nextjs` top-level
 * yüklenir, OpenTelemetry `require-in-the-middle` bağımlılıklarını tetikler
 * ve Turbopack dev modunda modül çözümleme başarısız olur.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryModule = typeof import('@sentry/nextjs')

async function loadSentry(): Promise<SentryModule | null> {
  if (process.env.NODE_ENV === 'development') return null
  if (!process.env.SENTRY_DSN) return null
  return await import('@sentry/nextjs')
}

export async function register() {
  const Sentry = await loadSentry()
  if (!Sentry) return

  const sharedConfig: Parameters<SentryModule['init']>[0] = {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.05,
    debug: false,
    beforeSend: (event) => {
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        const sensitiveKeys = ['password', 'token', 'tcNo', 'tcKimlikNo', 'creditCard', 'phone', 'email']
        for (const key of sensitiveKeys) {
          if (key in data) data[key] = '[REDACTED]'
        }
      }
      if (event.request?.headers) {
        const headers = { ...event.request.headers }
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
        for (const key of sensitiveHeaders) {
          if (key in headers) headers[key] = '[REDACTED]'
        }
        event.request.headers = headers
      }
      return event
    },
    ignoreErrors: [
      'AbortError',
      'The operation was aborted',
    ],
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(sharedConfig)
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(sharedConfig)
  }
}

export const onRequestError: (
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: 'Pages Router' | 'App Router'; routePath: string; routeType: string }
) => void | Promise<void> = async (err, request, context) => {
  const Sentry = await loadSentry()
  if (!Sentry) return
  return Sentry.captureRequestError(err, request, context)
}
