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
 *   - ENCRYPTION_KEY (base64, 32 byte) AES (encrypt) için kullanılır.
 *   - HMAC anahtarı: varsayılan ham ENCRYPTION_KEY (eski davranış, key reuse).
 *     `TC_HMAC_HKDF=true` ile master key'den HKDF-SHA256 ile bağımsız bir HMAC
 *     alt-anahtarı türetilir — AES anahtarından kriptografik olarak ayrık.
 *     Flag açıldığında tcHash değişir → tüm tc_hash satırlarının bir kerelik
 *     backfill/rehash'i ZORUNLU (bkz. getHmacKey üstündeki uyarı bloğu).
 *   - Anahtar rotasyonu: yeni anahtarla DB'deki tüm TC'ler yeniden encrypt + rehash
 *     edilmeli (ileride bir rotation script'i ile).
 */
import crypto from 'crypto'
import { encrypt, decrypt } from './crypto'
import { normalizeTcKimlik } from './tc'

// HKDF info etiketi — gizli değil, sadece türetilen anahtarı bağlama bağlar.
const TC_HMAC_INFO = 'tc-hmac-v1'
// Sabit salt (gizli değil). HKDF master key'i AES kullanımından bağımsız bir
// HMAC alt-anahtarına ayırır.
const TC_HMAC_SALT = Buffer.from('tc-crypto')

/**
 * ⚠️ ANAHTAR AYRIMI / BACKFILL UYARISI (KVKK + güvenlik):
 *
 * Eski davranış: ENCRYPTION_KEY (AES-256-GCM veri anahtarı) AYNI ZAMANDA
 * ham HMAC-SHA256 anahtarı olarak kullanılıyordu → tek anahtar iki primitive'de
 * (key reuse). Bunu kırmak için HKDF ile master key'den AES'ten kriptografik
 * olarak BAĞIMSIZ bir HMAC alt-anahtarı türetiyoruz.
 *
 * BACKWARD-COMPAT: HKDF türetilmiş anahtar tcHash çıktısını TÜM kayıtlar için
 * değiştirir → mevcut TC lookup'ları (eski hash'lerle) artık eşleşmez. Bu yüzden
 * yeni davranış `TC_HMAC_HKDF=true` env flag'i ile GATE'lenir (varsayılan KAPALI
 * = ham master key, mevcut davranış).
 *
 * AÇMADAN ÖNCE: tüm User.tc_hash satırlarını yeni HKDF anahtarıyla bir kerelik
 * rehash/backfill et (anahtar rotasyonu script'i — tc_encrypted'ı decrypt edip
 * yeniden hash'le). Backfill çalışmadan flag açılırsa yeni hash eski satırlarla
 * eşleşmez ve TC sorguları boş döner.
 */
function getHmacKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('[tc-crypto] ENCRYPTION_KEY ortam değişkeni tanımlı değil.')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('[tc-crypto] ENCRYPTION_KEY 32 byte (base64) olmalı.')
  }
  // Varsayılan: ham master key (mevcut hash'lerle uyumlu).
  // Flag açıkken: HKDF ile AES'ten bağımsız HMAC alt-anahtarı (backfill gerektirir).
  if (process.env.TC_HMAC_HKDF === 'true') {
    return Buffer.from(crypto.hkdfSync('sha256', buf, TC_HMAC_SALT, Buffer.from(TC_HMAC_INFO), 32))
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
