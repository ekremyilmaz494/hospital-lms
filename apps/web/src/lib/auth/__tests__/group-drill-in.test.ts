import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { organization: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } } }))

import { orgInOwnerGroup, invalidateGroupMembershipCache } from '../group-drill-in'

beforeEach(() => {
  mockFindFirst.mockReset()
  invalidateGroupMembershipCache()
})

describe('orgInOwnerGroup — grup drill-in yetki sınırı', () => {
  it('sorgu grupta + AKTİF + askıda-değil koşullarını içerir (askı bypass\'ı kapalı)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'orgX' })
    await orgInOwnerGroup('orgX', 'grpA')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'orgX', groupId: 'grpA', isActive: true, isSuspended: false },
      }),
    )
  })

  it('grup-içi AKTİF hastane → true', async () => {
    mockFindFirst.mockResolvedValue({ id: 'orgX' })
    expect(await orgInOwnerGroup('orgX', 'grpA')).toBe(true)
  })

  it('GÜVENLİK: askıya alınmış hastane → false (where isSuspended:false eşleşmez) → drill-in reddedilir', async () => {
    // Askı sonrası DB satırı where'i geçmez → findFirst null döner.
    mockFindFirst.mockResolvedValue(null)
    expect(await orgInOwnerGroup('orgX', 'grpA')).toBe(false)
  })

  it('grup-DIŞI hastane → false', async () => {
    mockFindFirst.mockResolvedValue(null)
    expect(await orgInOwnerGroup('orgY', 'grpA')).toBe(false)
  })

  it('30s cache: ikinci çağrı DB\'ye gitmez (aynı sonuç)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'orgX' })
    await orgInOwnerGroup('orgX', 'grpA', 1_000)
    await orgInOwnerGroup('orgX', 'grpA', 5_000) // < 30s sonra
    expect(mockFindFirst).toHaveBeenCalledTimes(1)
  })

  it('cache süresi dolunca (>30s) yeniden DB sorgular → askı/çıkarma yansır', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'orgX' }) // ilk: aktif
    mockFindFirst.mockResolvedValueOnce(null)            // sonra: askıya alındı
    expect(await orgInOwnerGroup('orgX', 'grpA', 1_000)).toBe(true)
    expect(await orgInOwnerGroup('orgX', 'grpA', 40_000)).toBe(false) // >30s → re-query
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })
})
