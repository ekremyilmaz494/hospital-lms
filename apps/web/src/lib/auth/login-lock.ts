import { getRedis } from '@/lib/redis'

/**
 * Hesap-bazlı başarısız giriş kilidi.
 *
 * Mevcut IP/e-posta rate-limit'i (5 dk pencere) saldırgan IP değiştirince yetersiz kalıyordu;
 * bu modül e-POSTA bazında ardışık başarısız denemeleri sayar ve eşik aşılınca hesabı
 * geçici olarak kilitler. Redis birincil kaynaktır (mevcut `login-fail:` sayacının deseni);
 * Redis yoksa fail-open davranır (kilit uygulanmaz, login bloklanmaz).
 */
const LOCK_THRESHOLD = 5 // bu kadar ardışık başarısız denemede kilitle
const LOCK_DURATION_SEC = 15 * 60 // 15 dakika
const FAIL_WINDOW_SEC = 15 * 60 // sayaç penceresi

const failKey = (email: string) => `login-fail:${email}`
const lockKey = (email: string) => `login-locked:${email}`

export const LOGIN_LOCK = { threshold: LOCK_THRESHOLD, durationSec: LOCK_DURATION_SEC } as const

/** Hesap şu an kilitli mi? Kilitliyse kalan saniyeyi de döner. */
export async function getAccountLock(email: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  const redis = getRedis()
  if (!redis) return { locked: false, retryAfterSec: 0 }
  try {
    const ttl = await redis.ttl(lockKey(email))
    if (typeof ttl === 'number' && ttl > 0) return { locked: true, retryAfterSec: ttl }
  } catch {
    /* best-effort — Redis hatasında kilidi uygulamayız */
  }
  return { locked: false, retryAfterSec: 0 }
}

/**
 * Başarısız denemeyi kaydeder; eşik aşılırsa hesabı `LOCK_DURATION_SEC` boyunca kilitler.
 * @returns failCount (mevcut ardışık başarısız sayısı) + locked (bu denemeyle kilitlendi mi)
 */
export async function registerFailedLogin(email: string): Promise<{ failCount: number; locked: boolean }> {
  const redis = getRedis()
  if (!redis) return { failCount: 0, locked: false }
  try {
    await redis.set(failKey(email), 0, { nx: true, ex: FAIL_WINDOW_SEC })
    const failCount = await redis.incr(failKey(email))
    if (failCount >= LOCK_THRESHOLD) {
      await redis.set(lockKey(email), 1, { ex: LOCK_DURATION_SEC })
      return { failCount, locked: true }
    }
    return { failCount, locked: false }
  } catch {
    return { failCount: 0, locked: false }
  }
}

/** Başarılı girişte sayaç + kilidi temizler. */
export async function clearLoginLock(email: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await Promise.all([redis.del(failKey(email)), redis.del(lockKey(email))])
  } catch {
    /* best-effort */
  }
}
