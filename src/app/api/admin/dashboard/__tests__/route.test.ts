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

import { GET } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockUserCount = vi.mocked(prisma.user.count)
const mockTrainingCount = vi.mocked(prisma.training.count)
const mockTrainingFindMany = vi.mocked(prisma.training.findMany)
const mockAssignmentGroupBy = vi.mocked(prisma.trainingAssignment.groupBy)
const mockAssignmentFindMany = vi.mocked(prisma.trainingAssignment.findMany)
const mockAuditLogFindMany = vi.mocked(prisma.auditLog.findMany)
const mockCertificateFindMany = vi.mocked(prisma.certificate.findMany)

describe('GET /api/admin/dashboard', () => {
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

  it('returns dashboard stats on success', async () => {
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

    // Mock assignment status aggregation (new groupBy pattern)
    mockAssignmentGroupBy.mockResolvedValue([
      { status: 'passed', _count: 5 },
      { status: 'failed', _count: 2 },
      { status: 'in_progress', _count: 3 },
    ] as never)

    // Mock compulsory trainings
    mockTrainingFindMany.mockResolvedValue([] as never)

    // Mock audit logs
    mockAuditLogFindMany.mockResolvedValue([] as never)

    // Mock overdue + top performer + department assignments
    mockAssignmentFindMany.mockResolvedValue([] as never)

    // Mock expiring certificates
    mockCertificateFindMany.mockResolvedValue([] as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.stats).toBeDefined()
    expect(Array.isArray(data.stats)).toBe(true)
    expect(data.stats.length).toBe(5)

    // Verify stat titles (Turkce karakter degisikligi dahil)
    const titles = data.stats.map((s: { title: string }) => s.title)
    expect(titles).toContain('Toplam Personel')
    expect(titles).toContain('Aktif Egitim')
    expect(titles).toContain('Tamamlanma Orani')
    expect(titles).toContain('Geciken Egitim')
    expect(titles).toContain('Uyum Orani')

    // Verify other sections exist
    expect(data.complianceAlerts).toBeDefined()
    expect(data.trendData).toBeDefined()
    expect(data.statusDistribution).toBeDefined()
    expect(data.departmentComparison).toBeDefined()
    expect(data.overdueTrainings).toBeDefined()
    expect(data.expiringCerts).toBeDefined()
    expect(data.topPerformers).toBeDefined()
    expect(data.recentActivity).toBeDefined()
  })
})
