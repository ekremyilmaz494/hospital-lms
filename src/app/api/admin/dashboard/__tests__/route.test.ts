import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(),
  jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
  errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { count: vi.fn() },
    training: { count: vi.fn(), findMany: vi.fn() },
    trainingAssignment: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    certificate: { count: vi.fn(), findMany: vi.fn() },
    examAttempt: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { GET } from '../stats/route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockUserCount = vi.mocked(prisma.user.count)
const mockTrainingCount = vi.mocked(prisma.training.count)
const mockTrainingFindMany = vi.mocked(prisma.training.findMany)
const mockAssignmentGroupBy = vi.mocked(prisma.trainingAssignment.groupBy)

describe('GET /api/admin/dashboard/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: null,
      dbUser: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when not admin role', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'user-1' },
      dbUser: { id: 'user-1', role: 'staff', organizationId: 'org-1', isActive: true },
      error: null,
    } as never)

    mockRequireRole.mockReturnValue(
      Response.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })

  it('returns stats data on success', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'admin-1' },
      dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1', isActive: true },
      error: null,
    } as never)

    mockRequireRole.mockReturnValue(null)

    // Mock staff counts
    mockUserCount.mockResolvedValue(25 as never)

    // Mock training counts
    mockTrainingCount.mockResolvedValue(10 as never)

    // Mock assignment status aggregation
    mockAssignmentGroupBy.mockResolvedValue([
      { status: 'passed', _count: 5 },
      { status: 'failed', _count: 2 },
      { status: 'in_progress', _count: 3 },
    ] as never)

    // Mock compulsory trainings
    mockTrainingFindMany.mockResolvedValue([] as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.stats).toBeDefined()
    expect(Array.isArray(data.stats)).toBe(true)
    expect(data.stats.length).toBe(5)

    // Verify stat titles
    const titles = data.stats.map((s: { title: string }) => s.title)
    expect(titles).toContain('Toplam Personel')
    expect(titles).toContain('Aktif Egitim')
    expect(titles).toContain('Tamamlanma Orani')
    expect(titles).toContain('Geciken Egitim')
    expect(titles).toContain('Uyum Orani')

    // Verify stats endpoint returns these sections
    expect(data.complianceAlerts).toBeDefined()
    expect(data.statusDistribution).toBeDefined()
  })
})
