/**
 * Next.js instrumentation hook. Sentry'i dev'de yüklememek için tüm Sentry
 * import'ları dinamik yapılmıştır — aksi halde `@sentry/nextjs` top-level
 * yüklenir, OpenTelemetry `require-in-the-middle` bağımlılıklarını tetikler
 * ve Turbopack dev modunda modül çözümleme başarısız olur.
 */

 
type SentryModule = typeof import('@sentry/nextjs')

// KVKK: Hassas alan anahtarlari (TC kimlik, telefon, e-posta, kart vb.).
// Anahtar adi bu desenlerden birini (case-insensitive) ICERIYORSA deger maskelenir.
const PII_KEY_PATTERNS = [
  'password', 'token', 'secret', 'authorization', 'cookie',
  'tc', 'tckimlik', 'kimlik', 'identity',
  'phone', 'gsm', 'msisdn', 'email',
  'card', 'iban', 'creditcard',
]

function keyIsSensitive(key: string): boolean {
  const lower = key.toLowerCase()
  return PII_KEY_PATTERNS.some((p) => lower.includes(p))
}

/**
 * Ic ice gecmis obje/array'leri herhangi bir derinlikte gezerek, anahtari
 * hassas desenlerle eslesen degerleri '[REDACTED]' ile maskeleyen derin kopya
 * uretir. Eski sig (yalniz top-level anahtar listesi) ic objelerdeki PII'yi
 * (orn. { staff: { tcKimlikNo } }, bulk-import array'leri) Sentry'e siziyordu.
 * Dongulere karsi `seen` set + derinlik limiti (6) ile korunur.
 */
function redactPII(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => redactPII(item, seen, depth + 1))
  }

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = keyIsSensitive(key) ? '[REDACTED]' : redactPII(val, seen, depth + 1)
  }
  return out
}

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
      // Request body'den hassas alanlari recursive olarak temizle (ic ice obje/array dahil)
      if (event.request?.data) {
        event.request.data = redactPII(event.request.data)
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
