import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationSubscription: {
      findUnique: vi.fn(),
    },
    user: {
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

import { prisma } from '@/lib/prisma'
import { checkSubscriptionLimit } from '../subscription-guard'

const mockFindUnique = prisma.organizationSubscription.findUnique as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockTrainingCount = prisma.training.count as ReturnType<typeof vi.fn>

const ORG_ID = 'org-test-uuid-1234'

beforeEach(() => {
  vi.clearAllMocks()
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

  describe('staff limit checks', () => {
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

    it('returns null when plan has no staff limit (maxStaff is null)', async () => {
      mockFindUnique.mockResolvedValue({
        status: 'active',
        plan: { maxStaff: null, maxTrainings: null },
      })

      const result = await checkSubscriptionLimit(ORG_ID, 'staff')
      expect(result).toBeNull()
      // user.count should not be called when maxStaff is null
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
