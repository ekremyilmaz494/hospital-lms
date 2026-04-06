import { Redis } from '@upstash/redis'

// ── Lazy Redis client — null if not configured or unreachable ──
let _redis: Redis | null = null
export function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  const token = process.env.REDIS_TOKEN
  // Placeholder veya boş değerler varsa Redis'i atla
  if (!url || !token || url.includes('your-redis') || token.includes('your-redis')) return null
  _redis = new Redis({ url, token })
  return _redis
}

// Resets the cached client so next call to getRedis() retries the connection.
function resetRedis() {
  _redis = null
}

// ── In-memory fallback (dev/staging when Redis is not configured or unreachable) ──
const memoryTimers = new Map<string, number>()
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>()

// ── Exam Timer ──

const EXAM_TIMER_PREFIX = 'exam:timer:'

export async function startExamTimer(attemptId: string, durationMinutes: number) {
  const expiresAt = Date.now() + durationMinutes * 60 * 1000
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(`${EXAM_TIMER_PREFIX}${attemptId}`, expiresAt, {
        ex: durationMinutes * 60 + 60,
      })
      return expiresAt
    } catch {
      resetRedis()
    }
  }
  memoryTimers.set(attemptId, expiresAt)
  return expiresAt
}

export async function getExamTimeRemaining(attemptId: string): Promise<number | null> {
  const redis = getRedis()
  let expiresAt: number | null = null
  if (redis) {
    try {
      expiresAt = await redis.get<number>(`${EXAM_TIMER_PREFIX}${attemptId}`)
    } catch {
      resetRedis()
      expiresAt = memoryTimers.get(attemptId) ?? null
    }
  } else {
    expiresAt = memoryTimers.get(attemptId) ?? null
  }
  if (!expiresAt) return null
  const remaining = Math.max(0, expiresAt - Date.now())
  return Math.ceil(remaining / 1000)
}

export async function isExamExpired(attemptId: string): Promise<boolean> {
  const remaining = await getExamTimeRemaining(attemptId)
  // Timer yoksa (hiç başlatılmamışsa) expired DEĞİL — submit'i engellemesin
  if (remaining === null) return false
  return remaining <= 0
}

export async function clearExamTimer(attemptId: string) {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(`${EXAM_TIMER_PREFIX}${attemptId}`)
      return
    } catch {
      resetRedis()
    }
  }
  memoryTimers.delete(attemptId)
}

// ── API Response Cache ──

const memoryCache = new Map<string, { value: string; expiresAt: number }>()

/**
 * Get a cached value by key.
 * Returns null if not found, expired, or on Redis error.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw == null) return null
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
    } catch {
      resetRedis()
    }
  }
  const entry = memoryCache.get(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return JSON.parse(entry.value) as T
}

/**
 * Cache a value with TTL in seconds.
 * Falls back to in-memory if Redis is unavailable.
 */
export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds })
      return
    } catch {
      resetRedis()
    }
  }
  memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/**
 * Invalidate a cached key (e.g., after a write operation).
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
    } catch {
      resetRedis()
    }
  }
  memoryCache.delete(key)
}

/**
 * Generic cache-aside wrapper: check cache first, on miss execute fetchFn,
 * cache the result with the given TTL, and return.
 */
export async function withCache<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
  const cached = await getCached<T>(key)
  if (cached !== null) return cached
  const result = await fetchFn()
  await setCached(key, result, ttlSeconds)
  return result
}

/**
 * Invalidate all cache keys matching pattern "cache:{orgId}:{entity}:*".
 * Uses Redis SCAN for production; clears matching in-memory keys as fallback.
 */
export async function invalidateOrgCache(orgId: string, entity: string): Promise<void> {
  const prefix = `cache:${orgId}:${entity}:`
  const redis = getRedis()
  if (redis) {
    try {
      let cursor = '0'
      do {
        const result: [string, string[]] = await redis.scan(cursor, { match: `${prefix}*`, count: 100 })
        cursor = result[0]
        const keys = result[1]
        if (keys.length > 0) {
          await Promise.all(keys.map((k: string) => redis.del(k)))
        }
      } while (cursor !== '0')
    } catch {
      resetRedis()
    }
  }
  // In-memory fallback: clear matching keys
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k)
    }
  }
}

// ── Rate Limiting ──

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      const k = `ratelimit:${key}`
      await redis.set(k, 0, { nx: true, ex: windowSeconds })
      const current = await redis.incr(k)
      return current <= maxRequests
    } catch {
      // Redis unreachable — fall through to in-memory fallback
      resetRedis()
    }
  }

  // In-memory fallback
  const k = `ratelimit:${key}`
  const now = Date.now()
  const entry = memoryRateLimits.get(k)
  if (!entry || entry.expiresAt < now) {
    memoryRateLimits.set(k, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return true
  }
  entry.count++
  return entry.count <= maxRequests
}
