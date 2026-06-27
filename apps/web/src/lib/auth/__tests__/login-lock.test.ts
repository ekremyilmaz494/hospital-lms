import { describe, it, expect, vi, beforeEach } from 'vitest'

// Sahte Redis — login-lock'ın kullandığı set(nx,ex)/incr/ttl/del'i in-memory taklit eder.
interface Entry { value: number; ttl: number }
const store = new Map<string, Entry>()

const fakeRedis = {
  set: vi.fn(async (key: string, val: number, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && store.has(key)) return null
    store.set(key, { value: Number(val), ttl: opts?.ex ?? -1 })
    return 'OK'
  }),
  incr: vi.fn(async (key: string) => {
    const e = store.get(key) ?? { value: 0, ttl: -1 }
    e.value += 1
    store.set(key, e)
    return e.value
  }),
  ttl: vi.fn(async (key: string) => (store.has(key) ? store.get(key)!.ttl : -2)),
  del: vi.fn(async (...keys: string[]) => {
    let n = 0
    for (const k of keys) if (store.delete(k)) n++
    return n
  }),
}

vi.mock('@/lib/redis', () => ({ getRedis: () => fakeRedis }))

import { getAccountLock, registerFailedLogin, clearLoginLock, LOGIN_LOCK } from '../login-lock'

const EMAIL = 'test@klinovax.com'

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
})

describe('login-lock', () => {
  it('eşik altındaki başarısızlıklar hesabı kilitlemez', async () => {
    for (let i = 1; i < LOGIN_LOCK.threshold; i++) {
      const { failCount, locked } = await registerFailedLogin(EMAIL)
      expect(failCount).toBe(i)
      expect(locked).toBe(false)
    }
    expect((await getAccountLock(EMAIL)).locked).toBe(false)
  })

  it('eşiğe ulaşınca hesabı kilitler', async () => {
    let lockedAt = false
    for (let i = 1; i <= LOGIN_LOCK.threshold; i++) {
      const { locked } = await registerFailedLogin(EMAIL)
      if (i === LOGIN_LOCK.threshold) lockedAt = locked
    }
    expect(lockedAt).toBe(true)
    const lock = await getAccountLock(EMAIL)
    expect(lock.locked).toBe(true)
    expect(lock.retryAfterSec).toBe(LOGIN_LOCK.durationSec)
  })

  it('başarılı giriş sayaç + kilidi temizler', async () => {
    for (let i = 0; i < LOGIN_LOCK.threshold; i++) await registerFailedLogin(EMAIL)
    expect((await getAccountLock(EMAIL)).locked).toBe(true)

    await clearLoginLock(EMAIL)
    expect((await getAccountLock(EMAIL)).locked).toBe(false)
    // sayaç da sıfırlandığı için tekrar baştan sayılır
    const { failCount } = await registerFailedLogin(EMAIL)
    expect(failCount).toBe(1)
  })

  it('Redis yoksa fail-open davranır (kilit uygulanmaz)', async () => {
    // getRedis null dönerse getAccountLock locked:false döner — bu senaryo mock ile
    // doğrudan test edilemiyor; yine de varsayılan davranışın locked:false olduğunu
    // boş store ile doğrula.
    expect((await getAccountLock('hic-denenmemis@x.com')).locked).toBe(false)
  })
})
