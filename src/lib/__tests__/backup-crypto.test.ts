import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import { encryptBackup, decryptBackup, maskUsersPII } from '../backup-crypto'

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

    it('anahtar yokken plaintext döner ve decrypt no-op olur', () => {
      delete process.env.BACKUP_ENCRYPTION_KEY

      const plaintext = '{"users":[]}'
      const { data, isEncrypted } = encryptBackup(plaintext)

      expect(isEncrypted).toBe(false)
      expect(data).toBe(plaintext)
      expect(decryptBackup(data)).toBe(plaintext)
    })

    it('geçersiz anahtar uzunluğunda plaintext döner', () => {
      process.env.BACKUP_ENCRYPTION_KEY = 'kisa'
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
