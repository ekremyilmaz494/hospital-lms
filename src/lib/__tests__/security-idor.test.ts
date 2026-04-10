import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn((role: string, allowed: string[]) => {
    if (!allowed.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 })
    return null
  }),
  jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
  errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  createAuditLog: vi.fn(),
  parseBody: vi.fn(),
  computeAuditHash: vi.fn().mockReturnValue('hash'),
  safePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    training: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    trainingAssignment: { groupBy: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    department: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn(),
  withCache: vi.fn((_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidateCache: vi.fn(),
  invalidateOrgCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), withRequestId: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/dashboard-cache', () => ({ invalidateDashboardCache: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ encrypt: vi.fn((v: string) => v), decrypt: vi.fn((v: string) => v), safeDecryptTcNo: vi.fn((v: string | null) => v) }))

import { getAuthUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)

function mockAuth(role: string, orgId: string) {
  mockGetAuthUser.mockResolvedValue({
    user: { id: 'user-1' },
    dbUser: { id: 'user-1', role, organizationId: orgId, isActive: true, firstName: 'Test', lastName: 'User', email: 'test@test.com' },
    error: null,
  } as never)
}

describe('IDOR Güvenlik Testleri', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('Cross-Organization Veri İzolasyonu', () => {
    it('Admin personel sorgusu organizationId filtresi içermeli', async () => {
      mockAuth('admin', 'org-a')
      const mockFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>
      mockFindMany.mockResolvedValue([])
      ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      const { GET } = await import('@/app/api/admin/staff/route')
      await GET(new Request('http://localhost/api/admin/staff?page=1&limit=20'))

      // withCache callback içinde findMany çağrılır — organizationId filtresi olmalı
      const calls = mockFindMany.mock.calls
      const hasOrgFilter = calls.some((call: unknown[]) =>
        JSON.stringify(call).includes('org-a')
      )
      expect(hasOrgFilter).toBe(true)
    })

    it('Admin eğitim sorgusu organizationId filtresi içermeli', async () => {
      mockAuth('admin', 'org-b')
      const mockFindMany = prisma.training.findMany as ReturnType<typeof vi.fn>
      mockFindMany.mockResolvedValue([])
      ;(prisma.training.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      const { GET } = await import('@/app/api/admin/trainings/route')
      await GET(new Request('http://localhost/api/admin/trainings?page=1&limit=20'))

      const calls = mockFindMany.mock.calls
      const hasOrgFilter = calls.some((call: unknown[]) =>
        JSON.stringify(call).includes('org-b')
      )
      expect(hasOrgFilter).toBe(true)
    })
  })

  describe('Rol Bazlı Erişim Engeli', () => {
    it('Staff rolü admin personel endpoint\'ine erişememeli (403)', async () => {
      mockAuth('staff', 'org-a')
      const { GET } = await import('@/app/api/admin/staff/route')
      const res = await GET(new Request('http://localhost/api/admin/staff'))
      expect(res.status).toBe(403)
    })

    it('Staff rolü admin eğitim endpoint\'ine erişememeli (403)', async () => {
      mockAuth('staff', 'org-a')
      const { GET } = await import('@/app/api/admin/trainings/route')
      const res = await GET(new Request('http://localhost/api/admin/trainings'))
      expect(res.status).toBe(403)
    })

    it('Yetkisiz kullanıcı 401 almalı', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: null,
        dbUser: null,
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      } as never)

      const { GET } = await import('@/app/api/admin/staff/route')
      const res = await GET(new Request('http://localhost/api/admin/staff'))
      expect(res.status).toBe(401)
    })
  })
})
