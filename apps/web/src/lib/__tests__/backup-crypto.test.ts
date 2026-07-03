import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import { encryptBackup, decryptBackup, maskUsersPII, stringifyBackup, stripSensitiveBackupFields } from '../backup-crypto'

// 32 byte (64 hex) deterministik test anahtarı
const TEST_KEY = 'a'.repeat(64)

describe('backup-crypto', () => {
  const originalKey = process.env.BACKUP_ENCRYPTION_KEY

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const originalOldKey = process.env.BACKUP_ENCRYPTION_KEY_OLD

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.BACKUP_ENCRYPTION_KEY
    } else {
      process.env.BACKUP_ENCRYPTION_KEY = originalKey
    }
    if (originalOldKey === undefined) {
      delete process.env.BACKUP_ENCRYPTION_KEY_OLD
    } else {
      process.env.BACKUP_ENCRYPTION_KEY_OLD = originalOldKey
    }
    // Güvenlik denetimi: plaintext fallback artık opt-in (ALLOW_PLAINTEXT_BACKUP) — testler arası temizle.
    delete process.env.ALLOW_PLAINTEXT_BACKUP
  })

  describe('encryptBackup / decryptBackup round-trip', () => {
    it('anahtar varken şifreler ve geri çözer', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY

      const plaintext = JSON.stringify({ users: [{ id: '1', phone: '05321234567' }] })
      const { data: encrypted, isEncrypted } = encryptBackup(plaintext)

      expect(isEncrypted).toBe(true)
      expect(encrypted).not.toBe(plaintext)
      expect(encrypted.split(':').length).toBe(3)

      const decrypted = decryptBackup(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('anahtar yok + ALLOW_PLAINTEXT_BACKUP=true → plaintext (opt-in) ve decrypt no-op', () => {
      delete process.env.BACKUP_ENCRYPTION_KEY
      process.env.ALLOW_PLAINTEXT_BACKUP = 'true' // O8: düz metin artık yalnız açık opt-in ile

      const plaintext = '{"users":[]}'
      const { data, isEncrypted } = encryptBackup(plaintext)

      expect(isEncrypted).toBe(false)
      expect(data).toBe(plaintext)
      expect(decryptBackup(data)).toBe(plaintext)
    })

    it('anahtar yok + opt-in YOK → THROW (KVKK: düz metin PII yazma)', () => {
      delete process.env.BACKUP_ENCRYPTION_KEY
      delete process.env.ALLOW_PLAINTEXT_BACKUP
      expect(() => encryptBackup('{"users":[]}')).toThrow(/BACKUP_ENCRYPTION_KEY/)
    })

    it('geçersiz anahtar uzunluğu + opt-in → plaintext', () => {
      process.env.BACKUP_ENCRYPTION_KEY = 'kisa'
      process.env.ALLOW_PLAINTEXT_BACKUP = 'true'
      const { data, isEncrypted } = encryptBackup('test')
      expect(isEncrypted).toBe(false)
      expect(data).toBe('test')
    })

    it('her çağrıda farklı IV üretir (aynı plaintext → farklı ciphertext)', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY
      const a = encryptBackup('aynı veri')
      const b = encryptBackup('aynı veri')
      expect(a.data).not.toBe(b.data)
    })

    it('bozuk auth tag → decrypt Error fırlatır (sessizce yutmaz)', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY
      const { data: encrypted } = encryptBackup('önemli veri')

      const [iv, , ciphertext] = encrypted.split(':')
      const fakeAuthTag = '0'.repeat(32)
      const tampered = `${iv}:${fakeAuthTag}:${ciphertext}`

      expect(() => decryptBackup(tampered)).toThrow()
    })

    it('ciphertext tampering → decrypt Error fırlatır', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY
      const { data: encrypted } = encryptBackup('önemli veri')

      const [iv, authTag, ciphertext] = encrypted.split(':')
      // Son byte'ı değiştir
      const tamperedCipher = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'ff' ? '00' : 'ff')
      const tampered = `${iv}:${authTag}:${tamperedCipher}`

      expect(() => decryptBackup(tampered)).toThrow()
    })

    it('yanlış anahtarla decrypt Error fırlatır', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY
      const { data: encrypted } = encryptBackup('önemli veri')

      process.env.BACKUP_ENCRYPTION_KEY = 'b'.repeat(64)
      expect(() => decryptBackup(encrypted)).toThrow()
    })

    it('şifrelenmemiş JSON içinde ":" olsa bile decrypt no-op yapar', () => {
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY
      const plainJson = '{"key":"value","url":"https://a.com"}'
      // Anahtar tanımlı olsa da format eşleşmediği için olduğu gibi dönmeli
      expect(decryptBackup(plainJson)).toBe(plainJson)
    })

    it('gerçek crypto.randomBytes ile büyük payload round-trip', () => {
      process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')

      const big = JSON.stringify({ rows: Array.from({ length: 1000 }, (_, i) => ({ id: i, v: 'x'.repeat(50) })) })
      const { data, isEncrypted } = encryptBackup(big)
      expect(isEncrypted).toBe(true)
      expect(decryptBackup(data)).toBe(big)
    })
  })

  describe('key rotation (BACKUP_ENCRYPTION_KEY_OLD fallback)', () => {
    it('eski anahtarla şifrelenmiş yedek yeni anahtar aktifken çözülebilir', () => {
      const oldKey = 'a'.repeat(64)
      const newKey = 'b'.repeat(64)

      process.env.BACKUP_ENCRYPTION_KEY = oldKey
      const { data: encrypted } = encryptBackup('rotasyon testi')

      process.env.BACKUP_ENCRYPTION_KEY = newKey
      process.env.BACKUP_ENCRYPTION_KEY_OLD = oldKey

      expect(decryptBackup(encrypted)).toBe('rotasyon testi')
    })

    it('hem yeni hem eski anahtar yanlışsa Error fırlatır', () => {
      process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64)
      const { data: encrypted } = encryptBackup('veri')

      process.env.BACKUP_ENCRYPTION_KEY = 'c'.repeat(64)
      process.env.BACKUP_ENCRYPTION_KEY_OLD = 'd'.repeat(64)

      expect(() => decryptBackup(encrypted)).toThrow()
    })

    it('eski anahtar tanımlı değilse yeni anahtar başarısız olunca Error atar', () => {
      process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64)
      const { data: encrypted } = encryptBackup('veri')

      process.env.BACKUP_ENCRYPTION_KEY = 'b'.repeat(64)
      delete process.env.BACKUP_ENCRYPTION_KEY_OLD

      expect(() => decryptBackup(encrypted)).toThrow()
    })

    it('yeni anahtar doğru ise eski anahtar denenmez (öncelik yeni anahtarda)', () => {
      const key = 'a'.repeat(64)
      process.env.BACKUP_ENCRYPTION_KEY = key
      const { data: encrypted } = encryptBackup('öncelik testi')

      // OLD yanlış olsa bile primary başarılı olduğu için sorun olmamalı
      process.env.BACKUP_ENCRYPTION_KEY_OLD = 'f'.repeat(64)
      expect(decryptBackup(encrypted)).toBe('öncelik testi')
    })
  })

  describe('maskUsersPII', () => {
    it('telefonu maskeleyip son 3 haneyi bırakır', () => {
      const result = maskUsersPII([{ id: '1', phone: '05321234567', name: 'Ali' }])
      expect(result[0].phone).toBe('********567')
      expect(result[0].name).toBe('Ali')
    })

    it('telefon yoksa null döner', () => {
      const result = maskUsersPII([{ id: '1' }])
      expect(result[0].phone).toBeNull()
    })

    it('3 veya daha kısa telefon olduğu gibi kalır', () => {
      const result = maskUsersPII([{ id: '1', phone: '12' }])
      expect(result[0].phone).toBe('12')
    })

    it('orijinal nesneyi değiştirmez (immutable)', () => {
      const users = [{ id: '1', phone: '05321234567' }]
      maskUsersPII(users)
      expect(users[0].phone).toBe('05321234567')
    })
  })
})

describe('stringifyBackup (BigInt-güvenli yedek serialization)', () => {
  it('BigInt içeren veriyi fırlatmadan serialize eder', () => {
    expect(() => stringifyBackup({ a: BigInt(123) })).not.toThrow()
  })

  it('düz JSON.stringify BigInt\'te fırlatır (regresyonun kanıtı)', () => {
    // Bu, 14.05.2026 prod yedek crash\'inin tam nedeni — stringifyBackup bunu çözer.
    expect(() => JSON.stringify({ a: BigInt(123) })).toThrow()
  })

  it('nested fileSizeBytes → string; restore BigInt() ile geri çevirir', () => {
    const data = { trainings: [{ videos: [{ id: 'v1', fileSizeBytes: BigInt(4567890123) }] }] }
    const parsed = JSON.parse(stringifyBackup(data))
    const fsb = parsed.trainings[0].videos[0].fileSizeBytes
    expect(typeof fsb).toBe('string')
    expect(fsb).toBe('4567890123')
    expect(BigInt(fsb)).toBe(BigInt(4567890123)) // restore route\'undaki coercion
  })

  it('BigInt olmayan değerleri olduğu gibi bırakır', () => {
    const data = { n: 5, s: 'x', b: true, nil: null, arr: [1, 2] }
    expect(JSON.parse(stringifyBackup(data))).toEqual(data)
  })

  it('null fileSizeBytes (eski yedek) korunur', () => {
    const parsed = JSON.parse(stringifyBackup({ videos: [{ fileSizeBytes: null }] }))
    expect(parsed.videos[0].fileSizeBytes).toBeNull()
  })
})

describe('stripSensitiveBackupFields (indirme parola/PII koruması)', () => {
  it('authUsers (parola hash) çıkarılır, diğer veri korunur', () => {
    const json = JSON.stringify({
      users: [{ id: 'u1' }],
      authUsers: [{ id: 'u1', encrypted_password: 'bcrypt$xyz' }],
      schemaVersion: 3,
    })
    const out = JSON.parse(stripSensitiveBackupFields(json))
    expect(out.authUsers).toBeUndefined()
    expect(out.users).toEqual([{ id: 'u1' }])
    expect(out.schemaVersion).toBe(3)
  })

  it('authUsers yoksa veri aynen döner', () => {
    const json = JSON.stringify({ users: [{ id: 'u1' }] })
    expect(JSON.parse(stripSensitiveBackupFields(json))).toEqual({ users: [{ id: 'u1' }] })
  })

  it('parse edilemeyen girdi ham veriyi SIZDIRMAZ', () => {
    const out = stripSensitiveBackupFields('bcrypt-leak{{{NOT-JSON')
    expect(out).not.toContain('bcrypt-leak')
    expect(JSON.parse(out).error).toBe('backup_unreadable')
  })

  it('v5: staffIntegrations[].pullCredentialsEncrypted soyulur, diğer alanlar korunur', () => {
    const json = JSON.stringify({
      users: [{ id: 'u1' }],
      staffIntegrations: [
        { id: 'si1', channel: 'pull', pullBaseUrl: 'https://hbys.example', pullCredentialsEncrypted: 'iv:tag:cipher' },
        { id: 'si2', channel: 'api', pullCredentialsEncrypted: null },
      ],
      schemaVersion: 5,
    })
    const out = JSON.parse(stripSensitiveBackupFields(json))
    expect(out.staffIntegrations).toHaveLength(2)
    expect(out.staffIntegrations[0].pullCredentialsEncrypted).toBeUndefined()
    expect(out.staffIntegrations[1].pullCredentialsEncrypted).toBeUndefined()
    // Konfigürasyonun geri kalanı dursun — indirilen dosya yine işe yarar olmalı
    expect(out.staffIntegrations[0].pullBaseUrl).toBe('https://hbys.example')
    expect(out.staffIntegrations[0].channel).toBe('pull')
    expect(out.users).toEqual([{ id: 'u1' }])
  })

  it('v5: staffIntegrations yoksa (v4 ve öncesi yedek) veri aynen döner', () => {
    const json = JSON.stringify({ users: [{ id: 'u1' }], schemaVersion: 4 })
    expect(JSON.parse(stripSensitiveBackupFields(json))).toEqual({ users: [{ id: 'u1' }], schemaVersion: 4 })
  })
})
