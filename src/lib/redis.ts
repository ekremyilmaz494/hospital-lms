import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

// ── Exam Timer ──

const EXAM_TIMER_PREFIX = 'exam:timer:'

export async function startExamTimer(attemptId: string, durationMinutes: number) {
  const expiresAt = Date.now() + durationMinutes * 60 * 1000
  await redis.set(`${EXAM_TIMER_PREFIX}${attemptId}`, expiresAt, {
    ex: durationMinutes * 60 + 60, // extra minute buffer
  })
  return expiresAt
}

export async function getExamTimeRemaining(attemptId: string): Promise<number | null> {
  const expiresAt = await redis.get<number>(`${EXAM_TIMER_PREFIX}${attemptId}`)
  if (!expiresAt) return null
  const remaining = Math.max(0, expiresAt - Date.now())
  return Math.ceil(remaining / 1000) // seconds
}

export async function isExamExpired(attemptId: string): Promise<boolean> {
  const remaining = await getExamTimeRemaining(attemptId)
  return remaining === null || remaining <= 0
}

export async function clearExamTimer(attemptId: string) {
  await redis.del(`${EXAM_TIMER_PREFIX}${attemptId}`)
}

// ── Rate Limiting ──

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    const k = `ratelimit:${key}`
    // SET NX+EX atomik: key yoksa olustur ve TTL ata (tek cagrida)
    await redis.set(k, 0, { nx: true, ex: windowSeconds })
    const current = await redis.incr(k)
    return current <= maxRequests
  } catch {
    // Redis baglantisi yoksa rate limit bypass (fail-open)
    return true
  }
}
