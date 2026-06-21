import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers')
  return {
    ...actual,
    getAuthUser: vi.fn(),
    getAuthUserStrict: vi.fn(),
    requireRole: vi.fn(),
    checkWritePermission: vi.fn().mockResolvedValue(null),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    jsonResponse: vi.fn((data: unknown, status = 200, headers?: Record<string, string>) =>
      Response.json(data, { status, headers }),
    ),
    errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pointLedger: { aggregate: vi.fn() },
    userStreak: { findUnique: vi.fn() },
    badge: { findMany: vi.fn() },
    userBadge: { findMany: vi.fn() },
  },
}))

import { GET } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockAgg = vi.mocked(prisma.pointLedger.aggregate)
const mockStreak = vi.mocked(prisma.userStreak.findUnique)
const mockBadge = vi.mocked(prisma.badge.findMany)
const mockUserBadge = vi.mocked(prisma.userBadge.findMany)

const staffUser = {
  user: { id: 'staff-1' },
  dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1', isActive: true },
  error: null,
} as never

function req() {
  return new Request('http://localhost/api/staff/gamification/summary', { method: 'GET' })
}

describe('GET /api/staff/gamification/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)
  })

  it('points=SUM, streak ve rozet kazanım durumunu döner', async () => {
    mockAgg.mockResolvedValue({ _sum: { points: 240 } } as never)
    mockStreak.mockResolvedValue({ current: 3, longest: 7, freezesLeft: 1, lastActiveDate: null } as never)
    mockBadge.mockResolvedValue([
      { id: 'b1', code: 'first_review', tier: 'bronze', icon: 'sparkles' },
      { id: 'b2', code: 'streak_30', tier: 'gold', icon: 'flame.fill' },
    ] as never)
    mockUserBadge.mockResolvedValue([{ badgeId: 'b1', earnedAt: new Date('2026-06-20T08:00:00Z') }] as never)

    const res = await GET(req())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.points).toBe(240)
    expect(data.streak).toMatchObject({ current: 3, longest: 7, freezesLeft: 1 })
    expect(typeof data.streak.atRisk).toBe('boolean')
    expect(data.badges).toHaveLength(2)
    expect(data.badges[0]).toMatchObject({ id: 'first_review', tier: 'bronze', icon: 'sparkles', earned: true })
    expect(data.badges[1]).toMatchObject({ id: 'streak_30', earned: false })
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })

  it('hiç veri yoksa güvenli varsayılanlar (points=0, current=0)', async () => {
    mockAgg.mockResolvedValue({ _sum: { points: null } } as never)
    mockStreak.mockResolvedValue(null as never)
    mockBadge.mockResolvedValue([] as never)
    mockUserBadge.mockResolvedValue([] as never)

    const res = await GET(req())
    const data = await res.json()

    expect(data.points).toBe(0)
    expect(data.streak).toMatchObject({ current: 0, longest: 0, atRisk: false })
    expect(data.badges).toEqual([])
  })
})
