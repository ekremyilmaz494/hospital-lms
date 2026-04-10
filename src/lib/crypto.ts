/**
 * AES-256-GCM şifreleme/çözme — HIS credential'larını DB'de güvenli saklamak için.
 *
 * Env: ENCRYPTION_KEY — base64 kodlanmış 32 byte (256-bit) anahtar
 * Üretmek için: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Format: iv_hex:authTag_hex:ciphertext_hex
 * IV: 12 byte (96-bit) — GCM native hızlandırması için standart boyut
 */
import crypto from 'crypto'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('[crypto] ENCRYPTION_KEY ortam değişkeni tanımlı değil. Lütfen .env dosyasına ekleyin.')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('[crypto] ENCRYPTION_KEY tam olarak 32 byte (256-bit) olmalı. Üretmek için: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
  }
  return buf
}

/**
 * Metni AES-256-GCM ile şifrele.
 * @returns "iv_hex:authTag_hex:ciphertext_hex" formatında şifrelenmiş string
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV — GCM için önerilen boyut
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * AES-256-GCM ile şifrelenmiş string'i çöz.
 * Auth tag doğrulaması otomatik — değiştirilmiş veri hata fırlatır.
 */
/**
 * TC No güvenli çözme — eski şifrelenmemiş değerlerle uyumlu.
 * Eğer değer ':' içermiyorsa şifrelenmemiş legacy değer olarak kabul eder.
 */
export function safeDecryptTcNo(value: string | null): string | null {
  if (!value) return null
  if (!value.includes(':')) return value // şifrelenmemiş legacy değer
  try { return decrypt(value) } catch { return value }
}

export function decrypt(token: string): string {
  const key = getKey()
  const parts = token.split(':')
  if (parts.length !== 3) {
    throw new Error('Şifreli veri formatı geçersiz — beklenen: iv:authTag:ciphertext')
  }
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
