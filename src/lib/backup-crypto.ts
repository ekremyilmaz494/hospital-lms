import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Backup şifreleme/çözme yardımcıları.
 *
 * Format: iv(12 byte hex) + ':' + authTag(16 byte hex) + ':' + ciphertext(hex)
 * Anahtar: BACKUP_ENCRYPTION_KEY env variable (32 byte hex = 64 karakter).
 *
 * Önemli: Bu modül cron backup, manual backup ve restore endpoint'leri arasında
 * format anlaşmasını tek kaynağa indirger. Her endpoint kendi helper'ını tutarsa
 * restore-decrypt asimetrisi yeniden oluşur.
 */

export interface EncryptResult {
  data: string
  isEncrypted: boolean
}

/** AES-256-GCM ile plaintext şifreler. Anahtar yoksa plaintext döner. */
export function encryptBackup(plaintext: string): EncryptResult {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    logger.warn('Backup', 'BACKUP_ENCRYPTION_KEY tanımlı değil veya geçersiz — yedek şifrelenmeden kaydedilecek')
    return { data: plaintext, isEncrypted: false }
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  const encryptedBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    data: `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuf.toString('hex')}`,
    isEncrypted: true,
  }
}

/**
 * Tek bir hex anahtarla AES-256-GCM çözme dener.
 * Hata (auth tag, format) durumunda Error fırlatır — caller fallback yapabilir.
 */
function decryptWithKey(parts: [string, string, string], hexKey: string): string {
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Şifrelenmiş backup verisini çözer. Şifrelenmemiş veriyi olduğu gibi döner.
 *
 * Anahtar rotasyonu desteği: önce BACKUP_ENCRYPTION_KEY, başarısız olursa
 * BACKUP_ENCRYPTION_KEY_OLD denenir. Böylece rotate edildikten sonra eski
 * yedekler hâlâ restore edilebilir. İki anahtar da başarısız olursa Error atar.
 */
export function decryptBackup(data: string): string {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  const oldKey = process.env.BACKUP_ENCRYPTION_KEY_OLD

  if (!key || key.length !== 64) return data

  const parts = data.split(':')
  if (parts.length !== 3 || parts[0].length !== 24 || parts[1].length !== 32) {
    return data
  }
  if (!/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1]) || !/^[0-9a-f]+$/i.test(parts[2])) {
    return data
  }

  const triple: [string, string, string] = [parts[0], parts[1], parts[2]]

  try {
    return decryptWithKey(triple, key)
  } catch (primaryErr) {
    if (oldKey && oldKey.length === 64 && oldKey !== key) {
      try {
        const result = decryptWithKey(triple, oldKey)
        logger.warn('Backup', 'Yedek eski anahtar ile çözüldü — re-encrypt gerekli')
        return result
      } catch {
        // her iki anahtar da başarısız — orijinal hatayı yeniden at
      }
    }
    throw primaryErr
  }
}

/**
 * KVKK export/rapor amaçlı PII maskeleme. Sadece dışarıya indirilecek dosyalarda
 * çağırılmalı — restore için kullanılan yedeklerde kullanılmamalıdır, aksi halde
 * telefon gibi veriler kalıcı olarak bozulur.
 */
export function maskUsersPII(users: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return users.map(u => ({
    ...u,
    phone: typeof u.phone === 'string' && u.phone.length > 3
      ? `${'*'.repeat(u.phone.length - 3)}${u.phone.slice(-3)}`
      : u.phone ?? null,
  }))
}
