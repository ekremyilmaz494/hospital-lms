/**
 * İK/HBYS entegrasyonu — makine (M2M) API anahtarı üretimi ve doğrulaması.
 *
 * Anahtar formatı: `klx_live_` + 40 karakter base62 ([A-Za-z0-9]).
 * DB'de YALNIZ SHA-256 hex özeti saklanır (`IntegrationApiKey.keyHash`) —
 * düz anahtar üretim anında bir kez gösterilir, bir daha geri alınamaz.
 * `keyPrefix` (ilk 6 rastgele karakter dahil) log/UI'da anahtarı tanımak içindir,
 * tek başına kimlik doğrulamada KULLANILMAZ.
 */

import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const KEY_PREFIX = 'klx_live_'
const RANDOM_LENGTH = 40
const PREFIX_RANDOM_CHARS = 6
/** Format ön-kontrolü üst sınırı — aşırı uzun token'lar hash'lenmeden reddedilir. */
const MAX_TOKEN_LENGTH = 120
/** lastUsedAt bu süreden bayatsa güncellenir — her istekte DB write olmasın. */
const LAST_USED_STALE_MS = 60_000

const BASE62_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
// 256 % 62 ≠ 0 → düz `byte % 62` modulo bias üretir. floor(256/62)*62 = 248;
// 248 ve üstü baytlar ATILIR (rejection sampling) → uniform dağılım.
const REJECTION_LIMIT = 248

/** crypto.randomBytes tabanlı, modulo-bias'sız base62 dize üretir. */
function randomBase62(length: number): string {
  let out = ''
  while (out.length < length) {
    const bytes = randomBytes(length)
    for (const byte of bytes) {
      if (byte >= REJECTION_LIMIT) continue
      out += BASE62_ALPHABET[byte % BASE62_ALPHABET.length]
      if (out.length === length) break
    }
  }
  return out
}

export interface GeneratedApiKey {
  /** Tam anahtar — çağıran YALNIZ BİR KEZ gösterir; DB'ye asla yazılmaz. */
  plaintext: string
  /** `klx_live_` + rastgele kısmın ilk 6 karakteri — log/UI'da tanıma için. */
  prefix: string
  /** SHA-256 hex özeti — DB'de saklanan tek temsil (`keyHash`). */
  hash: string
}

/**
 * Yeni bir entegrasyon API anahtarı üretir.
 *
 * Dönen `plaintext` kullanıcıya bir kez gösterilir; DB'ye `prefix` + `hash`
 * yazılır. Kayıp anahtar geri getirilemez — yenisi üretilir.
 */
export function generateApiKey(): GeneratedApiKey {
  const random = randomBase62(RANDOM_LENGTH)
  const plaintext = `${KEY_PREFIX}${random}`
  return {
    plaintext,
    prefix: `${KEY_PREFIX}${random.slice(0, PREFIX_RANDOM_CHARS)}`,
    hash: hashApiKey(plaintext),
  }
}

/** Düz API anahtarının SHA-256 hex özetini döndürür (DB lookup anahtarı). */
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export type VerifyApiKeyResult =
  | { ok: true; key: { id: string; organizationId: string; keyPrefix: string } }
  | { ok: false }

/**
 * Bearer token'ı doğrular: format ön-kontrol → hash → DB lookup → revoke/expiry.
 *
 * Başarısızlık nedenleri BİLİNÇLİ olarak ayırt edilmez (bilinmeyen / revoked /
 * expired hepsi `{ ok: false }`) — saldırgana anahtar durumu sızdırılmaz.
 * Başarıda `lastUsedAt` 60 sn'den bayatsa fire-and-forget güncellenir
 * (await edilmez; her istekte senkron DB write maliyeti olmasın).
 */
export async function verifyApiKey(token: string): Promise<VerifyApiKeyResult> {
  // Format ön-kontrolü — DB'ye gitmeden ucuz eleme (enum/DoS azaltma).
  if (!token || token.length > MAX_TOKEN_LENGTH || !token.startsWith('klx_')) {
    return { ok: false }
  }

  const keyHash = hashApiKey(token)
  const record = await prisma.integrationApiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      organizationId: true,
      keyPrefix: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  })

  if (!record) return { ok: false }
  if (record.revokedAt !== null) return { ok: false }
  if (record.expiresAt !== null && record.expiresAt.getTime() <= Date.now()) {
    return { ok: false }
  }

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > LAST_USED_STALE_MS) {
    // Fire-and-forget: hata olsa da isteği etkilemesin.
    void prisma.integrationApiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})
  }

  return {
    ok: true,
    key: {
      id: record.id,
      organizationId: record.organizationId,
      keyPrefix: record.keyPrefix,
    },
  }
}
