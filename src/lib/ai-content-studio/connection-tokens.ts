/**
 * Hesap bağlantı one-time token yönetimi.
 *
 * Akış:
 *  1. Admin "Bağla" tıklar → server token üretir, Redis'e {orgId, userId} ile yazar (10dk TTL)
 *  2. Token + LMS URL admin'e gösterilen tek-satır komutla embed edilir
 *  3. Admin terminale yapıştırır → script çalışır → token ile LMS'ye storage_state POST eder
 *  4. Server token'ı validate eder, ilgili org'a kaydeder, token'ı silinir
 */
import crypto from 'crypto'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

const TOKEN_PREFIX = 'nbconnect:'
const TOKEN_TTL_SEC = 600 // 10 dakika

interface TokenPayload {
  orgId: string
  userId: string
  createdAt: number
}

const memoryStore = new Map<string, { payload: TokenPayload; expiresAt: number }>()

function gcMemory() {
  const now = Date.now()
  for (const [k, v] of memoryStore) {
    if (v.expiresAt < now) memoryStore.delete(k)
  }
}

/** Yeni one-time token üret + Redis/memory'ye yaz. */
export async function issueConnectionToken(payload: { orgId: string; userId: string }): Promise<string> {
  const token = crypto.randomBytes(24).toString('base64url')
  const data: TokenPayload = { ...payload, createdAt: Date.now() }
  const redis = getRedis()
  const key = TOKEN_PREFIX + token
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), { ex: TOKEN_TTL_SEC })
    } catch (err) {
      logger.warn('NotebookConnect', 'Redis set failed — memory fallback', { err: String(err) })
      memoryStore.set(token, { payload: data, expiresAt: Date.now() + TOKEN_TTL_SEC * 1000 })
    }
  } else {
    memoryStore.set(token, { payload: data, expiresAt: Date.now() + TOKEN_TTL_SEC * 1000 })
  }
  gcMemory()
  return token
}

/** Token'ı tüket (consume) — bir kez okunabilir. Doğru token'sa payload, değilse null. */
export async function consumeConnectionToken(token: string): Promise<TokenPayload | null> {
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 64) return null
  const redis = getRedis()
  const key = TOKEN_PREFIX + token
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw) {
        await redis.del(key)
        const data = typeof raw === 'string' ? JSON.parse(raw) : (raw as TokenPayload)
        return data
      }
      return null
    } catch (err) {
      logger.warn('NotebookConnect', 'Redis consume failed — memory fallback', { err: String(err) })
    }
  }
  gcMemory()
  const entry = memoryStore.get(token)
  if (!entry) return null
  memoryStore.delete(token)
  return entry.payload
}

/** Token'ı tüketmeden sadece var mı diye bak (polling endpoint için). */
export async function peekConnectionToken(token: string): Promise<boolean> {
  if (!token) return false
  const redis = getRedis()
  const key = TOKEN_PREFIX + token
  if (redis) {
    try {
      const exists = await redis.exists(key)
      return exists === 1
    } catch {
      // fallthrough
    }
  }
  gcMemory()
  return memoryStore.has(token)
}
