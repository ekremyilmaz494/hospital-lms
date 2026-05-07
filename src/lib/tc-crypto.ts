/**
 * TC Kimlik No — sunucu tarafı şifreleme/HMAC yardımcıları.
 *
 * Bu dosya YALNIZCA sunucuda import edilmeli — `crypto` Node.js modülü kullanır.
 * Client component'lerden import etmeyin; bunun yerine `@/lib/tc` (pure validation)
 * dosyasını kullanın.
 *
 * Saklama formatı (User tablosu):
 *   tc_encrypted: AES-256-GCM ciphertext — `@/lib/crypto` encrypt() çıktısı
 *   tc_hash:      HMAC-SHA256 hex — deterministic, lookup için
 *
 * Anahtar yönetimi:
 *   - ENCRYPTION_KEY (base64, 32 byte) hem encrypt hem HMAC için aynı kullanılır.
 *   - Anahtar rotasyonu: yeni anahtarla DB'deki tüm TC'ler yeniden encrypt + rehash
 *     edilmeli (ileride bir rotation script'i ile). Şimdilik tek anahtar.
 */
import crypto from 'crypto'
import { encrypt, decrypt } from './crypto'
import { normalizeTcKimlik } from './tc'

function getHmacKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('[tc-crypto] ENCRYPTION_KEY ortam değişkeni tanımlı değil.')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('[tc-crypto] ENCRYPTION_KEY 32 byte (base64) olmalı.')
  }
  return buf
}

/**
 * HMAC-SHA256 hash — DB'de unique constraint ve lookup için.
 * Aynı TC her zaman aynı hash'i üretir (deterministic).
 */
export function hashTcKimlik(tc: string): string {
  const normalized = normalizeTcKimlik(tc)
  return crypto.createHmac('sha256', getHmacKey()).update(normalized).digest('hex')
}

/**
 * TC'yi şifrele — `@/lib/crypto` AES-256-GCM kullanılır.
 */
export function encryptTcKimlik(tc: string): string {
  return encrypt(normalizeTcKimlik(tc))
}

/**
 * Şifrelenmiş TC'yi çöz.
 *
 * KVKK NOTU: Çağıran taraf decrypt sonrası MUTLAKA AuditLog kaydı atmalı
 * (`action: 'TC_DECRYPTED_FOR_REPORT'`). Resmi denetim için "kim, ne zaman,
 * hangi personelin TC'sini gördü" kanıtı bu log üzerinden çıkar.
 */
export function decryptTcKimlik(ciphertext: string): string {
  return decrypt(ciphertext)
}

/**
 * Hash'in kısa prefix'i — audit log içinde "hangi TC" referansı için.
 * Plaintext TC asla audit log'a yazılmaz; bunun yerine hash'in ilk 8 karakteri
 * korelasyon için yeterli.
 */
export function tcAuditRef(tc: string): string {
  return hashTcKimlik(tc).slice(0, 8)
}
