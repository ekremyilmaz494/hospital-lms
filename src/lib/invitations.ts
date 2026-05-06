import crypto from 'node:crypto'

/**
 * Davet token üretimi ve doğrulama yardımcıları.
 *
 * Güvenlik modeli (TrustedDevice patterninin kopyası):
 *   - 256-bit rastgele token URL'de ve email'de (raw)
 *   - DB'de yalnız SHA-256 hash saklanır → DB leak olsa bile token kullanılamaz
 *   - Single-use: acceptedAt set olduktan sonra ikinci kullanımda 410
 *   - 72h geçerli
 *   - 5 yanlış denemeden sonra revoke (attemptCount artırılır)
 */

const TOKEN_BYTES = 32
const DEFAULT_TTL_HOURS = 72
const MAX_ATTEMPT_COUNT = 5

export interface InvitationTokenPair {
  raw: string
  hash: string
}

/**
 * Yeni davet token'ı üretir. `raw` URL/email'e gider, `hash` DB'ye yazılır.
 * URL-safe base64 (43 karakter) — URL escape gerekmez.
 */
export function generateInvitationToken(): InvitationTokenPair {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url')
  const hash = hashInvitationToken(raw)
  return { raw, hash }
}

/**
 * Raw token'ı SHA-256 ile hash'ler (hex). DB lookup için aynı fonksiyon kullanılır.
 */
export function hashInvitationToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/**
 * Davet expiry tarihini hesaplar (default 72 saat).
 */
export function computeInvitationExpiry(hours = DEFAULT_TTL_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

/**
 * Invitation'ın claim edilebilir durumda olup olmadığını kontrol eder.
 * `null` => geçerli, string => hata mesajı (kullanıcıya gösterilebilir TR mesaj).
 */
export function getInvitationClaimError(inv: {
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  attemptCount: number
}): string | null {
  if (inv.acceptedAt) return 'Bu davet daha önce kullanılmış.'
  if (inv.revokedAt) return 'Bu davet iptal edilmiş.'
  if (inv.expiresAt.getTime() < Date.now()) return 'Davetin süresi dolmuş.'
  if (inv.attemptCount >= MAX_ATTEMPT_COUNT) return 'Bu davet çok sayıda hatalı denemeyle iptal edildi.'
  return null
}

/**
 * Davet linkinin tam URL'ini üretir.
 * @param baseUrl `getAppUrl()` çıktısı (https://klinovax.com gibi)
 */
export function buildInvitationUrl(baseUrl: string, rawToken: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/davet/${encodeURIComponent(rawToken)}`
}

export const INVITATION_MAX_ATTEMPT_COUNT = MAX_ATTEMPT_COUNT
export const INVITATION_TTL_HOURS = DEFAULT_TTL_HOURS
