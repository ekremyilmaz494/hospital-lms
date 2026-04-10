import { Redis } from '@upstash/redis'

// ── Lazy Redis client — null if not configured or unreachable ──
let _redis: Redis | null = null
export function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  const token = process.env.REDIS_TOKEN
  // Placeholder veya boş değerler varsa Redis'i atla
  if (!url || !token || url.includes('your-redis') || token.includes('your-redis')) return null
  _redis = new Redis({ url, token, keepAlive: true })
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
  // Timer yoksa (hiç başlatılmamışsa veya temizlenmişse) expired kabul et
  if (remaining === null) return true
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
// L1: in-memory (0ms), L2: Redis (~20-200ms depending on region)

const memoryCache = new Map<string, { value: string; expiresAt: number }>()
const MAX_MEMORY_CACHE = 200

function memGet<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) memoryCache.delete(key)
    return null
  }
  return JSON.parse(entry.value) as T
}

function memSet(key: string, serialized: string, ttlSeconds: number) {
  // LRU eviction: en eski entry'leri sil
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const firstKey = memoryCache.keys().next().value
    if (firstKey) memoryCache.delete(firstKey)
  }
  memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/**
 * Get a cached value by key.
 * L1 (memory) → L2 (Redis) → null
 */
export async function getCached<T>(key: string): Promise<T | null> {
  // L1: in-memory check (0ms)
  const mem = memGet<T>(key)
  if (mem !== null) return mem

  // L2: Redis
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw == null) return null
      const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
      // Promote to L1 (use shorter TTL for memory — half of Redis TTL or 60s max)
      memSet(key, typeof raw === 'string' ? raw : JSON.stringify(raw), 60)
      return parsed
    } catch {
      resetRedis()
    }
  }
  return null
}

/**
 * Cache a value with TTL in seconds.
 * Writes to both L1 (memory) and L2 (Redis).
 */
export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value)
  // Always write to L1
  memSet(key, serialized, Math.min(ttlSeconds, 120))
  // Write to L2 (Redis) in background — don't await
  const redis = getRedis()
  if (redis) {
    redis.set(key, serialized, { ex: ttlSeconds }).catch(() => resetRedis())
  }
}

/**
 * Invalidate a cached key (e.g., after a write operation).
 */
export async function invalidateCache(key: string): Promise<void> {
  memoryCache.delete(key)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
    } catch {
      resetRedis()
    }
  }
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
  // Clear L1 memory cache matching keys
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k)
    }
  }
}

// ── Rate Limiting ──

/** Validates rate limit keys to reject unsafe characters (injection prevention) */
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9:._@-]+$/

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  // Key sanitization: reject keys with unsafe characters
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw new Error('Invalid rate limit key: contains unsafe characters')
  }

  const effectiveMax = maxRequests

  const redis = getRedis()
  if (redis) {
    try {
      const k = `ratelimit:${key}`
      const pipeline = redis.pipeline()
      pipeline.set(k, 0, { nx: true, ex: windowSeconds })
      pipeline.incr(k)
      const results = await pipeline.exec()
      const current = results[1] as number
      return current <= effectiveMax
    } catch {
      // Redis unreachable: fall through to in-memory fallback
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
  return entry.count <= effectiveMax
}

/** Get current rate limit count without incrementing */
export async function getRateLimitCount(key: string): Promise<number> {
  if (!SAFE_KEY_PATTERN.test(key)) return 0

  const redis = getRedis()
  if (redis) {
    try {
      const val = await redis.get(`ratelimit:${key}`)
      return typeof val === 'number' ? val : (parseInt(String(val ?? '0'), 10) || 0)
    } catch {
      resetRedis()
    }
  }

  const k = `ratelimit:${key}`
  const entry = memoryRateLimits.get(k)
  if (!entry || entry.expiresAt < Date.now()) return 0
  return entry.count
}

/** Increment rate limit counter (for failed attempts only) */
export async function incrementRateLimit(key: string, windowSeconds: number): Promise<void> {
  if (!SAFE_KEY_PATTERN.test(key)) return

  const redis = getRedis()
  if (redis) {
    try {
      const k = `ratelimit:${key}`
      const pipeline = redis.pipeline()
      pipeline.set(k, 0, { nx: true, ex: windowSeconds })
      pipeline.incr(k)
      await pipeline.exec()
      return
    } catch {
      resetRedis()
    }
  }

  const k = `ratelimit:${key}`
  const now = Date.now()
  const entry = memoryRateLimits.get(k)
  if (!entry || entry.expiresAt < now) {
    memoryRateLimits.set(k, { count: 1, expiresAt: now + windowSeconds * 1000 })
  } else {
    entry.count++
  }
}

/** Delete rate limit key (reset on successful login) */
export async function deleteRateLimit(key: string): Promise<void> {
  if (!SAFE_KEY_PATTERN.test(key)) return

  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(`ratelimit:${key}`)
    } catch {
      resetRedis()
    }
  }
  memoryRateLimits.delete(`ratelimit:${key}`)
}
