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

/**
 * Yedek verisini BigInt-GÜVENLİ JSON'a serialize eder.
 *
 * `JSON.stringify` BigInt'i serialize edemez ("Do not know how to serialize a BigInt").
 * Yedek verisinde `TrainingVideo.fileSizeBytes` gibi `BigInt` alanlar bulunur; düz
 * `JSON.stringify(backupData)` bu yüzden fırlatıp tüm yedeği başarısız kılıyordu
 * (Devakent prod: 14.05.2026'dan beri 0 başarılı yedek). BigInt → string'e çevrilir
 * (kayıpsız); restore tarafı `BigInt(...)` ile geri çevirir. Cron + manuel yedek
 * BU fonksiyonu kullanmalı — `JSON.stringify`'ı doğrudan çağırmamalı.
 */
export function stringifyBackup(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}

/**
 * İndirilen/insan-okunur yedekten HASSAS alanları çıkarır.
 *
 * `auth.users` satırları (bcrypt `encrypted_password` hash'leri + ham metadata)
 * yalnızca felaket-kurtarma RESTORE'u içindir; restore S3'i SUNUCU tarafında okur.
 * İndirme endpoint'i (`backups/[id]/download`) ham yedeği tarayıcıya veriyordu →
 * sıradan hastane admini tüm personelin parola hash'lerini indirebiliyordu (KVKK/güvenlik).
 * Bu fonksiyon decrypt edilmiş JSON'dan `authUsers`'ı ayıklar.
 *
 * v5: `staffIntegrations[].pullCredentialsEncrypted` (İK/HBYS pull kimlik bilgileri) de
 * soyulur — AES-256-GCM şifreli olsa da dışa inen dosyada durmasına gerek yok
 * (defense-in-depth); restore S3'teki ham yedeği sunucu tarafında okur, indirilen
 * dosyayı kullanmaz.
 *
 * @param backupJson decrypt edilmiş yedek JSON string'i
 * @returns hassas alanları çıkarılmış JSON string (parse edilemezse ham veriyi DÖNDÜRMEZ)
 */
export function stripSensitiveBackupFields(backupJson: string): string {
  try {
    const data = JSON.parse(backupJson)
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      delete d.authUsers
      if (Array.isArray(d.staffIntegrations)) {
        d.staffIntegrations = d.staffIntegrations.map((si: unknown) => {
          if (si && typeof si === 'object') {
            const rest = { ...(si as Record<string, unknown>) }
            delete rest.pullCredentialsEncrypted
            return rest
          }
          return si
        })
      }
    }
    return JSON.stringify(data)
  } catch {
    // Beklenmedik şekilde parse edilemezse güvenli tarafta kal — ham (şifresi çözülmüş) veriyi sızdırma.
    return JSON.stringify({ error: 'backup_unreadable' })
  }
}

/**
 * AES-256-GCM ile plaintext şifreler.
 *
 * GÜVENLİK (KVKK): Plaintext fallback artık NODE_ENV'e değil, AÇIK opt-in'e bağlı.
 * Önceki davranışta NODE_ENV !== 'production' olan HER ortamda (staging, preview, CI,
 * yanlış yapılandırılmış prod) anahtar yoksa yedek DÜZ METİN PII olarak yazılıyordu.
 * Staging/preview çoğu zaman prod benzeri gerçek veriyle çalıştığından bu doğrudan
 * KVKK ihlaliydi. Artık anahtar yoksa varsayılan DAVRANIŞ throw'dur; düz metin yalnızca
 * ALLOW_PLAINTEXT_BACKUP=true (yalnız sentetik veriyle) açıkça set edilirse mümkündür.
 */
export function encryptBackup(plaintext: string): EncryptResult {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    const plaintextAllowed = process.env.ALLOW_PLAINTEXT_BACKUP === 'true'
    if (!plaintextAllowed) {
      throw new Error(
        'BACKUP_ENCRYPTION_KEY zorunlu (64 karakter hex). Yedek PII içerebileceğinden ' +
        'düz metin yazılmaz. (Yalnızca sentetik veriyle ALLOW_PLAINTEXT_BACKUP=true ile geçilebilir.)'
      )
    }
    logger.warn('Backup', 'ALLOW_PLAINTEXT_BACKUP=true — yedek ŞİFRELENMEDEN kaydediliyor (yalnız sentetik veri için güvenli)')
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
