import { Redis } from '@upstash/redis'

// ── Logger helper (avoid console.log in production) ──
const logger = {
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[redis] ${message}`, meta ?? '')
    }
  },
}

// ── Key sanitization ──
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9:_\-@.]+$/

function sanitizeKey(key: string): string {
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid rate limit key: contains unsafe characters — "${key}"`)
  }
  return key
}

// ── Lazy Redis client — undefined if not configured ──
let _redis: Redis | null = null
export function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  const token = process.env.REDIS_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

// ── In-memory fallback (dev/staging when Redis is not configured) ──
const memoryTimers = new Map<string, number>()
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>()

// ── Exam Timer ──

const EXAM_TIMER_PREFIX = 'exam:timer:'

export async function startExamTimer(attemptId: string, durationMinutes: number) {
  const expiresAt = Date.now() + durationMinutes * 60 * 1000
  const redis = getRedis()
  if (redis) {
    await redis.set(`${EXAM_TIMER_PREFIX}${attemptId}`, expiresAt, {
      ex: durationMinutes * 60 + 60,
    })
  } else {
    memoryTimers.set(attemptId, expiresAt)
  }
  return expiresAt
}

export async function getExamTimeRemaining(attemptId: string): Promise<number | null> {
  const redis = getRedis()
  let expiresAt: number | null = null
  if (redis) {
    expiresAt = await redis.get<number>(`${EXAM_TIMER_PREFIX}${attemptId}`)
  } else {
    expiresAt = memoryTimers.get(attemptId) ?? null
  }
  if (!expiresAt) return null
  const remaining = Math.max(0, expiresAt - Date.now())
  return Math.ceil(remaining / 1000)
}

export async function isExamExpired(attemptId: string): Promise<boolean> {
  const remaining = await getExamTimeRemaining(attemptId)
  // Timer yoksa — ya hiç başlatılmamış ya da Redis TTL ile temizlenmiş.
  // Her iki durumda da süresi dolmuş kabul et (sınav bütünlüğü için kritik).
  if (remaining === null) {
    logger.warn('Exam timer not found — treating as expired', { attemptId })
    return true
  }
  return remaining <= 0
}

export async function clearExamTimer(attemptId: string) {
  const redis = getRedis()
  if (redis) {
    await redis.del(`${EXAM_TIMER_PREFIX}${attemptId}`)
  } else {
    memoryTimers.delete(attemptId)
  }
}

// ── Rate Limiting ──

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const sanitizedKey = sanitizeKey(key)
  const redis = getRedis()
  if (redis) {
    try {
      const k = `ratelimit:${sanitizedKey}`
      await redis.set(k, 0, { nx: true, ex: windowSeconds })
      const current = await redis.incr(k)
      return current <= maxRequests
    } catch {
      return false // fail-closed
    }
  }

  // In-memory fallback — apply stricter limits in production
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    logger.warn('Redis unavailable in production — using in-memory rate limiter with stricter limits', { key: sanitizedKey })
  }
  const effectiveMax = isProduction ? Math.max(1, Math.floor(maxRequests / 2)) : maxRequests
  const k = `ratelimit:${sanitizedKey}`
  const now = Date.now()
  const entry = memoryRateLimits.get(k)
  if (!entry || entry.expiresAt < now) {
    memoryRateLimits.set(k, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return true
  }
  entry.count++
  return entry.count <= effectiveMax
}
