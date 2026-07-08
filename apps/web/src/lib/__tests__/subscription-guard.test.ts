import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    organizationSubscription: {
      findUnique: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
    invitation: {
      count: vi.fn(),
    },
    training: {
      count: vi.fn(),
    },
  },
}))

// Mock api-helpers
vi.mock('@/lib/api-helpers', () => ({
  errorResponse: vi.fn((message: string, status: number) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
}))

// Mock deployment + lisans cache — varsayılan BULUT (isOnPrem=false); on-prem
// testleri kendi blokunda override eder. Böylece mevcut testler bulut yolundan geçer.
vi.mock('@/lib/deployment', () => ({
  isOnPrem: vi.fn(() => false),
}))
vi.mock('@/lib/license/cache', () => ({
  getLicenseState: vi.fn(async () => ({ state: 'VALID', limits: null })),
}))

import { prisma } from '@/lib/prisma'
import { isOnPrem } from '@/lib/deployment'
import { getLicenseState } from '@/lib/license/cache'
import { checkSubscriptionLimit, checkStaffLimit, resolveStaffLimit, countStaffSeats } from '../subscription-guard'

const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>
const mockFindUnique = prisma.organizationSubscription.findUnique as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockInviteCount = prisma.invitation.count as ReturnType<typeof vi.fn>
const mockTrainingCount = prisma.training.count as ReturnType<typeof vi.fn>
const mockIsOnPrem = isOnPrem as ReturnType<typeof vi.fn>
const mockGetLicenseState = getLicenseState as ReturnType<typeof vi.fn>

const ORG_ID = 'org-test-uuid-1234'

beforeEach(() => {
  vi.clearAllMocks()
  // Sensible defaults — testler kendi ihtiyacına göre ezer.
  mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
  mockInviteCount.mockResolvedValue(0)
  mockIsOnPrem.mockReturnValue(false) // varsayılan bulut; on-prem bloğu ezer
  mockGetLicenseState.mockResolvedValue({ state: 'VALID', limits: null })
})

describe('checkSubscriptionLimit', () => {
  it('returns null (allowed) when no subscription exists', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).toBeNull()
  })

  it('returns null when subscription has no plan', async () => {
    mockFindUnique.mockResolvedValue({ plan: null, status: 'active' })

    const result = await checkSubscriptionLimit(ORG_ID, 'staff')
    expect(result).toBeNull()
  })

  describe('subscription status checks', () => {
    it.each(['suspended', 'expired', 'cancelled'])(
      'returns 403 when subscription status is %s',
      async (status) => {
        mockFindUnique.mockResolvedValue({
          status,
          plan: { maxStaff: 10, maxTrainings: 5 },
        })

        const result = await checkSubscriptionLimit(ORG_ID, 'staff')
        expect(result).not.toBeNull()
        expect(result!.status).toBe(403)

        const body = await result!.json()
        expect(body.error).toContain('aktif değil')
      }
    )
  })

  describe('trial checks', () => {
    it('returns 403 when trial has expired (trialEndsAt in the past)', async () => {
      const pastDate = new Date('2024-01-01T00:00:00Z')
      mockFindUnique.mockResolvedValue({
        status: 'trial',
        trialEndsAt: pastDate,
        plan: { maxStaff: 10, maxTrainings: 5 },
      })

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)

      const body = await result!.json()
      expect(body.error).toContain('Deneme süreniz')
    })

    it('returns null when trial is still valid', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      mockFindUnique.mockResolvedValue({
        status: 'trial',
        trialEndsAt: futureDate,
        plan: { maxStaff: null, maxTrainings: null },
      })

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).toBeNull()
    })
  })

  describe('staff limit checks (delegates to checkStaffLimit)', () => {
    it('returns 403 when staff limit is reached', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: 5, maxTrainings: null },
      })
      mockUserCount.mockResolvedValue(5)

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)

      const body = await result!.json()
      expect(body.error).toContain('Personel limitine')
      expect(body.error).toContain('5/5')
    })

    it('returns null when staff limit is not reached', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: 10, maxTrainings: null },
      })
      mockUserCount.mockResolvedValue(3)

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).toBeNull()
    })

    it('returns null when neither org nor plan has a staff limit', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: null, maxTrainings: null },
      })

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).toBeNull()
      // limit null → koltuk sayımı hiç yapılmaz
      expect(mockUserCount).not.toHaveBeenCalled()
    })
  })

  describe('training limit checks', () => {
    it('returns 403 when training limit is reached', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: null, maxTrainings: 20 },
      })
      mockTrainingCount.mockResolvedValue(20)

      const result = await checkSubscriptionLimit(ORG_ID, 'training')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)

      const body = await result!.json()
      expect(body.error).toContain('Eğitim limitine')
      expect(body.error).toContain('20/20')
    })

    it('returns null when training limit is not reached', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: null, maxTrainings: 20 },
      })
      mockTrainingCount.mockResolvedValue(10)

      const result = await checkSubscriptionLimit(ORG_ID, 'training')
      expect(result).toBeNull()
    })

    it('returns null when plan has no training limit (maxTrainings is null)', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: null, maxTrainings: null },
      })

      const result = await checkSubscriptionLimit(ORG_ID, 'training')
      expect(result).toBeNull()
      // training.count should not be called when maxTrainings is null
      expect(mockTrainingCount).not.toHaveBeenCalled()
    })
  })

  describe('type-specific limit isolation', () => {
    it('does not check training count when type is staff', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: 10, maxTrainings: 5 },
      })
      mockUserCount.mockResolvedValue(3)

      await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(mockTrainingCount).not.toHaveBeenCalled()
    })

    it('does not check staff count when type is training', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: 10, maxTrainings: 5 },
      })
      mockTrainingCount.mockResolvedValue(2)

      await checkSubscriptionLimit(ORG_ID, 'training')
      expect(mockUserCount).not.toHaveBeenCalled()
    })
  })
})

describe('resolveStaffLimit — öncelik org override → plan → sınırsız', () => {
  it('org.maxStaff set edilmişse plan limitini EZER', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: 10 } })

    expect(await resolveStaffLimit(ORG_ID)).toBe(150)
  })

  it('org.maxStaff null ise plan.maxStaff geçerli', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: 25 } })

    expect(await resolveStaffLimit(ORG_ID)).toBe(25)
  })

  it('ikisi de yoksa null (sınırsız)', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })

    expect(await resolveStaffLimit(ORG_ID)).toBeNull()
  })

  it('abonelik hiç yoksa ve org override yoksa null', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue(null)

    expect(await resolveStaffLimit(ORG_ID)).toBeNull()
  })
})

describe('countStaffSeats — aktif personel + bekleyen davet', () => {
  it('personel + bekleyen davet toplamını döner', async () => {
    mockUserCount.mockResolvedValue(140)
    mockInviteCount.mockResolvedValue(8)

    expect(await countStaffSeats(ORG_ID)).toBe(148)
  })
})

describe('checkStaffLimit — seat guard', () => {
  it('sınırsızsa (limit null) her zaman izin verir, koltuk saymaz', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).toBeNull()
    expect(mockUserCount).not.toHaveBeenCalled()
  })

  it('org override limitinde tek ekleme engellenir (150/150)', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(148)
    mockInviteCount.mockResolvedValue(2) // 148 + 2 = 150 dolu

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('150/150')
    expect(body.error).toContain('Klinovax')
    // Frontend limit-uyarı modalı bu yapısal alanlara güvenir
    expect(body.code).toBe('STAFF_LIMIT_REACHED')
    expect(body.limit).toBe(150)
    expect(body.used).toBe(150)
  })

  it('limit altında ekleme serbest (149/150 → +1 = 150 ≤ 150)', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(149)
    mockInviteCount.mockResolvedValue(0)

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).toBeNull()
  })

  it('bekleyen davetler koltuğa sayılır → overshoot engellenir', async () => {
    // 100 personel + 50 bekleyen davet = 150 dolu, limit 150 → yeni davet blok
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(100)
    mockInviteCount.mockResolvedValue(50)

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('toplu ekleme (adding>1) kalan koltuğu aşarsa tüm batch reddedilir', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(145)
    mockInviteCount.mockResolvedValue(0) // 5 koltuk boş

    const result = await checkStaffLimit(ORG_ID, 10) // 10 eklenmek isteniyor
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('145/150')
    expect(body.error).toContain('10')
  })

  it('toplu ekleme kalan koltuğa tam sığarsa serbest (145 + 5 = 150)', async () => {
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 150 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(145)
    mockInviteCount.mockResolvedValue(0)

    const result = await checkStaffLimit(ORG_ID, 5)
    expect(result).toBeNull()
  })
})

describe('checkStaffLimit — on-prem GLOBAL lisans personel limiti', () => {
  beforeEach(() => {
    mockIsOnPrem.mockReturnValue(true)
  })

  it('global lisans limiti aşılırsa 403 (org limitinden ÖNCE bloklar)', async () => {
    mockGetLicenseState.mockResolvedValue({ state: 'VALID', limits: { maxStaff: 10 } })
    mockUserCount.mockResolvedValue(10) // kurulum genelinde 10 aktif personel
    mockInviteCount.mockResolvedValue(0)

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.code).toBe('STAFF_LIMIT_REACHED')
    expect(body.error).toContain('10/10')
    // Org-bazlı çözüme (resolveStaffLimit) HİÇ gitmemeli — lisans katmanı önce bloklar.
    expect(mockOrgFindUnique).not.toHaveBeenCalled()
  })

  it('global lisans limiti içindeyse ve org limiti yoksa serbest', async () => {
    mockGetLicenseState.mockResolvedValue({ state: 'VALID', limits: { maxStaff: 10 } })
    mockUserCount.mockResolvedValue(5)
    mockInviteCount.mockResolvedValue(0)
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue(null)

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).toBeNull()
  })

  it('lisansta staff limiti yoksa (limits.maxStaff yok) org limitine düşer', async () => {
    mockGetLicenseState.mockResolvedValue({ state: 'VALID', limits: { maxStaff: null } })
    mockOrgFindUnique.mockResolvedValue({ maxStaff: null })
    mockFindUnique.mockResolvedValue(null)

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).toBeNull()
  })

  it('bekleyen davetler global sayıma dahil (9 personel + 1 davet = limit)', async () => {
    mockGetLicenseState.mockResolvedValue({ state: 'VALID', limits: { maxStaff: 10 } })
    mockUserCount.mockResolvedValue(9)
    mockInviteCount.mockResolvedValue(1) // 9 + 1 = 10, +1 daha = 11 > 10

    const result = await checkStaffLimit(ORG_ID, 1)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('BULUT modunda (isOnPrem=false) lisans state HİÇ sorgulanmaz — main davranışı korunur', async () => {
    mockIsOnPrem.mockReturnValue(false)
    mockOrgFindUnique.mockResolvedValue({ maxStaff: 10 })
    mockFindUnique.mockResolvedValue({ plan: { maxStaff: null } })
    mockUserCount.mockResolvedValue(10)
    mockInviteCount.mockResolvedValue(0)

    const result = await checkStaffLimit(ORG_ID, 1) // org limiti dolu → 403 (bulut yolu)
    expect(result!.status).toBe(403)
    expect(mockGetLicenseState).not.toHaveBeenCalled()
  })
})
