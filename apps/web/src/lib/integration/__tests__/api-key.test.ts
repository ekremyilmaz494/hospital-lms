import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

/**
 * İK/HBYS entegrasyonu — API anahtarı üretimi/doğrulaması.
 *
 * Kilitlenen davranışlar:
 * - Format: `klx_live_` + 40 base62; prefix = ilk 6 rastgele karakter.
 * - Hash SHA-256 hex ve deterministik — DB'de yalnız hash saklanır.
 * - verifyApiKey: bilinmeyen/revoked/expired hepsi TEK TİP `{ ok: false }`
 *   (neden ayırt edilmez — bilgi sızdırma yok).
 * - lastUsedAt yalnız >60 sn bayatken fire-and-forget güncellenir.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { generateApiKey, hashApiKey, verifyApiKey } from '../api-key'

const mockFindUnique = prismaMock.integrationApiKey.findUnique
const mockUpdate = prismaMock.integrationApiKey.update

const VALID_TOKEN = `klx_live_${'a'.repeat(40)}`

function dbKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    organizationId: 'org-1',
    keyPrefix: 'klx_live_aaaaaa',
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Fire-and-forget update `.catch()` çağırır — mock her zaman promise dönmeli.
  mockUpdate.mockResolvedValue({})
})

describe('generateApiKey — format', () => {
  it('klx_live_ + 40 base62 karakter üretir (toplam 49)', () => {
    const { plaintext } = generateApiKey()
    expect(plaintext).toMatch(/^klx_live_[A-Za-z0-9]{40}$/)
    expect(plaintext).toHaveLength(49)
  })

  it('prefix = klx_live_ + rastgele kısmın ilk 6 karakteri', () => {
    const { plaintext, prefix } = generateApiKey()
    expect(prefix).toBe(`klx_live_${plaintext.slice(9, 15)}`)
    expect(prefix).toHaveLength(15)
  })

  it('hash 64 karakter hex ve plaintext\'in SHA-256 özeti', () => {
    const { plaintext, hash } = generateApiKey()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(createHash('sha256').update(plaintext).digest('hex'))
    expect(hash).toBe(hashApiKey(plaintext))
  })
})

describe('generateApiKey — benzersizlik', () => {
  it('100 üretimde plaintext/hash çakışması yok', () => {
    const plaintexts = new Set<string>()
    const hashes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const { plaintext, hash } = generateApiKey()
      plaintexts.add(plaintext)
      hashes.add(hash)
    }
    expect(plaintexts.size).toBe(100)
    expect(hashes.size).toBe(100)
  })
})

describe('hashApiKey — tutarlılık', () => {
  it('aynı girdi her çağrıda aynı hash', () => {
    const token = `klx_live_${'z'.repeat(40)}`
    expect(hashApiKey(token)).toBe(hashApiKey(token))
  })

  it('farklı girdiler farklı hash üretir', () => {
    expect(hashApiKey('klx_live_aaa')).not.toBe(hashApiKey('klx_live_aab'))
  })
})

describe('verifyApiKey', () => {
  it('geçerli anahtar → ok:true + id/organizationId/keyPrefix', async () => {
    mockFindUnique.mockResolvedValue(dbKey())
    const result = await verifyApiKey(VALID_TOKEN)
    expect(result).toEqual({
      ok: true,
      key: { id: 'key-1', organizationId: 'org-1', keyPrefix: 'klx_live_aaaaaa' },
    })
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash: hashApiKey(VALID_TOKEN) } }),
    )
  })

  it('gelecekte dolacak (expiresAt ileri tarih) anahtar → ok:true', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ expiresAt: new Date(Date.now() + 60_000) }))
    const result = await verifyApiKey(VALID_TOKEN)
    expect(result.ok).toBe(true)
  })

  it('bilinmeyen anahtar → { ok: false }', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await verifyApiKey(VALID_TOKEN)).toEqual({ ok: false })
  })

  it('revoked anahtar → { ok: false }', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ revokedAt: new Date() }))
    expect(await verifyApiKey(VALID_TOKEN)).toEqual({ ok: false })
  })

  it('süresi dolmuş anahtar → { ok: false }', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await verifyApiKey(VALID_TOKEN)).toEqual({ ok: false })
  })

  it('bilinmeyen/revoked/expired TEK TİP sonuç döner (bilgi sızdırma yok)', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const unknown = await verifyApiKey(VALID_TOKEN)
    mockFindUnique.mockResolvedValueOnce(dbKey({ revokedAt: new Date() }))
    const revoked = await verifyApiKey(VALID_TOKEN)
    mockFindUnique.mockResolvedValueOnce(dbKey({ expiresAt: new Date(Date.now() - 1) }))
    const expired = await verifyApiKey(VALID_TOKEN)
    expect(revoked).toEqual(unknown)
    expect(expired).toEqual(unknown)
    expect(Object.keys(unknown)).toEqual(['ok'])
  })

  it('klx_ ile başlamayan token → DB sorgusu bile yapılmadan { ok: false }', async () => {
    expect(await verifyApiKey('sk_live_yanlis_saglayici')).toEqual({ ok: false })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('120 karakterden uzun token → DB sorgusu yapılmadan { ok: false }', async () => {
    expect(await verifyApiKey(`klx_live_${'a'.repeat(150)}`)).toEqual({ ok: false })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('boş token → { ok: false }', async () => {
    expect(await verifyApiKey('')).toEqual({ ok: false })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('lastUsedAt >60 sn bayatsa fire-and-forget güncellenir', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ lastUsedAt: new Date(Date.now() - 120_000) }))
    await verifyApiKey(VALID_TOKEN)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'key-1' } }),
    )
  })

  it('lastUsedAt hiç yoksa (null) güncellenir', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ lastUsedAt: null }))
    await verifyApiKey(VALID_TOKEN)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('lastUsedAt tazeyse (<60 sn) HER İSTEKTE write yapılmaz', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ lastUsedAt: new Date() }))
    await verifyApiKey(VALID_TOKEN)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('lastUsedAt güncellemesi hata verse bile doğrulama başarılı kalır', async () => {
    mockFindUnique.mockResolvedValue(dbKey({ lastUsedAt: null }))
    mockUpdate.mockRejectedValue(new Error('db down'))
    const result = await verifyApiKey(VALID_TOKEN)
    expect(result.ok).toBe(true)
  })
})
