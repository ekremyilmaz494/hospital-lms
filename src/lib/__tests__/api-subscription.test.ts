import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationSubscription: { findUnique: vi.fn() },
    user: { count: vi.fn() },
    training: { count: vi.fn() },
  },
}))

vi.mock('@/lib/redis', () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => ({
  errorResponse: vi.fn((message: string, status: number) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
}))

import { prisma } from '@/lib/prisma'

const { checkSubscriptionStatus, checkSubscriptionLimit } = await import('../subscription-guard')

const mockSubFindUnique = prisma.organizationSubscription.findUnique as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>

const ORG_ID = 'org-subscription-test'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──

describe('checkSubscriptionStatus — Abonelik durumu', () => {
  describe('Trial durumu', () => {
    it('aktif trial icin status=active ve kalan gun doner', async () => {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 gun sonra
      mockSubFindUnique.mockResolvedValue({
        status: 'trial',
        trialEndsAt: trialEnd,
        expiresAt: null,
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('active')
      expect(result.daysLeft).toBeGreaterThanOrEqual(6)
      expect(result.daysLeft).toBeLessThanOrEqual(8)
      expect(result.isExpired).toBe(false)
    })

    it('suresi dolmus trial icin expired doner', async () => {
      const trialEnd = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 gun once
      mockSubFindUnique.mockResolvedValue({
        status: 'trial',
        trialEndsAt: trialEnd,
        expiresAt: null,
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('expired')
      expect(result.isExpired).toBe(true)
      expect(result.daysLeft).toBe(0)
    })

    it('trial ama trialEndsAt null ise expired doner', async () => {
      mockSubFindUnique.mockResolvedValue({
        status: 'trial',
        trialEndsAt: null,
        expiresAt: null,
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('expired')
      expect(result.isExpired).toBe(true)
    })
  })

  describe('Aktif abonelik', () => {
    it('suresiz aktif abonelik icin daysLeft 9999 doner', async () => {
      mockSubFindUnique.mockResolvedValue({
        status: 'active',
        trialEndsAt: null,
        expiresAt: null, // suresiz
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('active')
      expect(result.daysLeft).toBe(9999)
      expect(result.isExpired).toBe(false)
      expect(result.isGracePeriod).toBe(false)
    })

    it('sureli aktif abonelik kalan gunleri doner', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 gun sonra
      mockSubFindUnique.mockResolvedValue({
        status: 'active',
        trialEndsAt: null,
        expiresAt,
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('active')
      expect(result.daysLeft).toBeGreaterThanOrEqual(29)
      expect(result.daysLeft).toBeLessThanOrEqual(31)
      expect(result.isExpired).toBe(false)
    })
  })

  describe('Suspended durumu', () => {
    it('askiya alinmis abonelik icin suspended doner', async () => {
      mockSubFindUnique.mockResolvedValue({
        status: 'suspended',
        trialEndsAt: null,
        expiresAt: null,
      })

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('suspended')
      expect(result.isExpired).toBe(true)
      expect(result.daysLeft).toBe(0)
    })
  })

  describe('Abonelik bulunamadi', () => {
    it('subscription yoksa expired doner', async () => {
      mockSubFindUnique.mockResolvedValue(null)

      const result = await checkSubscriptionStatus(ORG_ID)
      expect(result.status).toBe('expired')
      expect(result.isExpired).toBe(true)
    })
  })
})

describe('Grace period (ek sure) mantigi', () => {
  it('suresi dolmus ama 7 gun icinde ise grace_period doner', async () => {
    const expiresAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 gun once dolmus
    mockSubFindUnique.mockResolvedValue({
      status: 'active',
      trialEndsAt: null,
      expiresAt,
    })

    const result = await checkSubscriptionStatus(ORG_ID)
    expect(result.status).toBe('grace_period')
    expect(result.isGracePeriod).toBe(true)
    expect(result.isExpired).toBe(false) // grace period'da expired false
    expect(result.daysLeft).toBeGreaterThanOrEqual(3) // 7-3 = 4 (yaklasik)
    expect(result.daysLeft).toBeLessThanOrEqual(5)
  })

  it('7. gunde hala grace_period', async () => {
    const expiresAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 gun once
    mockSubFindUnique.mockResolvedValue({
      status: 'active',
      trialEndsAt: null,
      expiresAt,
    })

    const result = await checkSubscriptionStatus(ORG_ID)
    expect(result.status).toBe('grace_period')
    expect(result.isGracePeriod).toBe(true)
  })

  it('8. gunde expired olur (grace period bitmis)', async () => {
    const expiresAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 gun once
    mockSubFindUnique.mockResolvedValue({
      status: 'active',
      trialEndsAt: null,
      expiresAt,
    })

    const result = await checkSubscriptionStatus(ORG_ID)
    expect(result.status).toBe('expired')
    expect(result.isExpired).toBe(true)
    expect(result.isGracePeriod).toBe(false)
    expect(result.daysLeft).toBe(0)
  })

  it('trial icin de grace period uygulanir', async () => {
    const trialEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 gun once dolmus
    mockSubFindUnique.mockResolvedValue({
      status: 'trial',
      trialEndsAt: trialEnd,
      expiresAt: null,
    })

    const result = await checkSubscriptionStatus(ORG_ID)
    expect(result.status).toBe('grace_period')
    expect(result.isGracePeriod).toBe(true)
  })
})

describe('checkSubscriptionLimit — Expired state yazma engeli', () => {
  it('suspended abonelikte yeni personel/egitim olusturulamaz', async () => {
    mockSubFindUnique.mockResolvedValue({
      status: 'suspended',
      plan: { maxStaff: 100, maxTrainings: 50 },
    })

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('aktif değil')
  })

  it('expired abonelikte yeni personel/egitim olusturulamaz', async () => {
    mockSubFindUnique.mockResolvedValue({
      status: 'expired',
      plan: { maxStaff: 100, maxTrainings: 50 },
    })

    const result = await checkSubscriptionLimit(ORG_ID, 'training')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('cancelled abonelikte yeni personel/egitim olusturulamaz', async () => {
    mockSubFindUnique.mockResolvedValue({
      status: 'cancelled',
      plan: { maxStaff: 100, maxTrainings: 50 },
    })

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('suresi dolmus trial abonelikte yazma engellenir', async () => {
    mockSubFindUnique.mockResolvedValue({
      status: 'trial',
      trialEndsAt: new Date('2024-01-01'),
      plan: { maxStaff: 10, maxTrainings: 5 },
    })

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('Deneme süreniz')
  })

  it('aktif abonelikte ve limit dahilinde yazma izin verilir', async () => {
    mockSubFindUnique.mockResolvedValue({
      status: 'active',
      plan: { maxStaff: 100, maxTrainings: 50 },
    })
    mockUserCount.mockResolvedValue(30)

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).toBeNull()
  })

  it('abonelik yoksa izin verilir (henuz setup edilmemis)', async () => {
    mockSubFindUnique.mockResolvedValue(null)

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).toBeNull()
  })
})
