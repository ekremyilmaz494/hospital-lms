import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pointLedger: { aggregate: vi.fn(), groupBy: vi.fn() },
    userStreak: { findUnique: vi.fn() },
    badge: { findMany: vi.fn() },
    userBadge: { findMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { evaluateBadges, meetsThreshold } from '../badges'
import { prisma } from '@/lib/prisma'

const mockAgg = vi.mocked(prisma.pointLedger.aggregate)
const mockGroupBy = vi.mocked(prisma.pointLedger.groupBy)
const mockStreak = vi.mocked(prisma.userStreak.findUnique)
const mockBadgeFind = vi.mocked(prisma.badge.findMany)
const mockEarnedFind = vi.mocked(prisma.userBadge.findMany)
const mockCreateMany = vi.mocked(prisma.userBadge.createMany)

describe('meetsThreshold', () => {
  const ctx = { points: 120, streak: { current: 2, longest: 8 }, countByType: new Map([['daily_review', 3]]) }

  it('points eşiği', () => {
    expect(meetsThreshold({ type: 'points', value: 100 }, ctx)).toBe(true)
    expect(meetsThreshold({ type: 'points', value: 1000 }, ctx)).toBe(false)
  })
  it('streak_longest eşiği', () => {
    expect(meetsThreshold({ type: 'streak_longest', value: 7 }, ctx)).toBe(true)
    expect(meetsThreshold({ type: 'streak_longest', value: 30 }, ctx)).toBe(false)
  })
  it('event_count eşiği', () => {
    expect(meetsThreshold({ type: 'event_count', eventType: 'daily_review', value: 1 }, ctx)).toBe(true)
    expect(meetsThreshold({ type: 'event_count', eventType: 'exam_pass', value: 1 }, ctx)).toBe(false)
  })
  it('geçersiz/eksik eşik → false', () => {
    expect(meetsThreshold({ type: 'points' }, ctx)).toBe(false)
    expect(meetsThreshold(null, ctx)).toBe(false)
    expect(meetsThreshold({ type: 'bilinmeyen', value: 1 }, ctx)).toBe(false)
  })
})

describe('evaluateBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMany.mockResolvedValue({ count: 0 } as never)
  })

  function setup() {
    mockAgg.mockResolvedValue({ _sum: { points: 120 } } as never)
    mockStreak.mockResolvedValue({ current: 2, longest: 8 } as never)
    mockBadgeFind.mockResolvedValue([
      { id: 'b1', code: 'points_100', tier: 'bronze', icon: 'star.fill', thresholdJson: { type: 'points', value: 100 } },
      { id: 'b2', code: 'streak_7', tier: 'silver', icon: 'flame.fill', thresholdJson: { type: 'streak_longest', value: 7 } },
      { id: 'b3', code: 'points_1000', tier: 'gold', icon: 'trophy.fill', thresholdJson: { type: 'points', value: 1000 } },
    ] as never)
    mockGroupBy.mockResolvedValue([{ eventType: 'daily_review', _count: { _all: 3 } }] as never)
  }

  it('yeni hak edilen rozetleri kazandırır, zaten kazanılanı atlar', async () => {
    setup()
    mockEarnedFind.mockResolvedValue([{ badgeId: 'b1' }] as never) // points_100 zaten kazanılmış

    const result = await evaluateBadges('u1', 'org1')

    // points 120 → points_100 zaten var (atla), points_1000 yetersiz; streak_longest 8>=7 → streak_7 kazanılır
    expect(result).toEqual([{ id: 'streak_7', tier: 'silver', icon: 'flame.fill' }])
    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: 'u1', badgeId: 'b2', organizationId: 'org1' }],
        skipDuplicates: true,
      }),
    )
  })

  it('yeni rozet yoksa boş döner, createMany çağrılmaz', async () => {
    setup()
    mockEarnedFind.mockResolvedValue([{ badgeId: 'b1' }, { badgeId: 'b2' }] as never) // ikisi de kazanılmış

    const result = await evaluateBadges('u1', 'org1')
    expect(result).toEqual([])
    expect(mockCreateMany).not.toHaveBeenCalled()
  })
})
