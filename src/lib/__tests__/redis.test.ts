import { describe, it, expect, beforeEach, vi } from 'vitest'

// Ensure no Redis env vars so in-memory fallback is used
delete process.env.REDIS_URL
delete process.env.REDIS_TOKEN

// Mock @upstash/redis to prevent real connections
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    get: vi.fn(),
    incr: vi.fn(),
    del: vi.fn(),
  })),
}))

// Dynamic import after mocks are set up
const {
  checkRateLimit,
  startExamTimer,
  getExamTimeRemaining,
  isExamExpired,
  clearExamTimer,
  getRedis,
} = await import('../redis')

describe('getRedis', () => {
  it('returns null when REDIS_URL and REDIS_TOKEN are not set', () => {
    expect(getRedis()).toBeNull()
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset in-memory rate limit state by calling with a unique key each time
    // We rely on unique keys per test to avoid cross-contamination
  })

  it('allows requests within limit', async () => {
    const key = `test:allow:${Date.now()}`
    const result1 = await checkRateLimit(key, 3, 60)
    const result2 = await checkRateLimit(key, 3, 60)
    const result3 = await checkRateLimit(key, 3, 60)

    expect(result1).toBe(true)
    expect(result2).toBe(true)
    expect(result3).toBe(true)
  })

  it('blocks when limit is exceeded', async () => {
    const key = `test:block:${Date.now()}`
    await checkRateLimit(key, 2, 60)
    await checkRateLimit(key, 2, 60)
    const result = await checkRateLimit(key, 2, 60)

    expect(result).toBe(false)
  })

  it('works with in-memory fallback (getRedis returns null)', async () => {
    expect(getRedis()).toBeNull()
    const key = `test:fallback:${Date.now()}`
    const result = await checkRateLimit(key, 5, 60)
    expect(result).toBe(true)
  })

  it('resets counter after window expires', async () => {
    const key = `test:expire:${Date.now()}`
    // Use a very short window (1 second)
    await checkRateLimit(key, 1, 1)
    // Should be blocked now
    const blocked = await checkRateLimit(key, 1, 1)
    expect(blocked).toBe(false)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const allowed = await checkRateLimit(key, 1, 1)
    expect(allowed).toBe(true)
  })

  it('rejects keys with unsafe characters (sanitizeKey)', async () => {
    await expect(checkRateLimit('test key with spaces', 5, 60)).rejects.toThrow(
      'Invalid rate limit key: contains unsafe characters'
    )
  })

  it('rejects keys with special characters', async () => {
    await expect(checkRateLimit('test;DROP TABLE', 5, 60)).rejects.toThrow(
      'Invalid rate limit key: contains unsafe characters'
    )
  })

  it('rejects keys with newlines', async () => {
    await expect(checkRateLimit('test\nkey', 5, 60)).rejects.toThrow(
      'Invalid rate limit key: contains unsafe characters'
    )
  })

  it('accepts keys with allowed characters (colons, dots, hyphens, underscores, @)', async () => {
    const key = `api:auth:login_user-1@example.com`
    const result = await checkRateLimit(key, 5, 60)
    expect(result).toBe(true)
  })

  it('applies stricter limits in production mode', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })

    try {
      const key = `test:prod:${Date.now()}`
      // maxRequests = 4 => effectiveMax = 2 in production
      await checkRateLimit(key, 4, 60)
      await checkRateLimit(key, 4, 60)
      const result = await checkRateLimit(key, 4, 60)
      expect(result).toBe(false)
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true, configurable: true })
    }
  })
})

describe('startExamTimer', () => {
  it('stores timer and returns expiration timestamp', async () => {
    const before = Date.now()
    const expiresAt = await startExamTimer('attempt-1', 30)
    const after = Date.now()

    // Should be roughly 30 minutes from now
    const expectedMin = before + 30 * 60 * 1000
    const expectedMax = after + 30 * 60 * 1000
    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin)
    expect(expiresAt).toBeLessThanOrEqual(expectedMax)
  })

  it('uses in-memory fallback when Redis is not configured', async () => {
    expect(getRedis()).toBeNull()
    const expiresAt = await startExamTimer('attempt-memory', 10)
    expect(typeof expiresAt).toBe('number')
    expect(expiresAt).toBeGreaterThan(Date.now())
  })
})

describe('getExamTimeRemaining', () => {
  it('returns remaining seconds for an active timer', async () => {
    await startExamTimer('attempt-remaining', 5)
    const remaining = await getExamTimeRemaining('attempt-remaining')

    expect(remaining).not.toBeNull()
    // Should be roughly 5 minutes (300 seconds), allow some tolerance
    expect(remaining!).toBeGreaterThan(295)
    expect(remaining!).toBeLessThanOrEqual(300)
  })

  it('returns null for unknown attempt', async () => {
    const remaining = await getExamTimeRemaining('nonexistent-attempt-id')
    expect(remaining).toBeNull()
  })
})

describe('isExamExpired', () => {
  it('returns false for an active timer', async () => {
    await startExamTimer('attempt-active', 10)
    const expired = await isExamExpired('attempt-active')
    expect(expired).toBe(false)
  })

  it('returns true when timer does not exist', async () => {
    const expired = await isExamExpired('nonexistent-attempt')
    expect(expired).toBe(true)
  })

  it('returns true when timer has expired', async () => {
    // Start a timer with 0 minutes (effectively already expired)
    await startExamTimer('attempt-expired', 0)
    // Small delay to ensure we're past the expiration
    await new Promise((resolve) => setTimeout(resolve, 10))
    const expired = await isExamExpired('attempt-expired')
    expect(expired).toBe(true)
  })
})

describe('clearExamTimer', () => {
  it('removes an existing timer', async () => {
    await startExamTimer('attempt-clear', 10)
    const beforeClear = await getExamTimeRemaining('attempt-clear')
    expect(beforeClear).not.toBeNull()

    await clearExamTimer('attempt-clear')
    const afterClear = await getExamTimeRemaining('attempt-clear')
    expect(afterClear).toBeNull()
  })

  it('does not throw when clearing a nonexistent timer', async () => {
    await expect(clearExamTimer('nonexistent-clear')).resolves.not.toThrow()
  })
})
