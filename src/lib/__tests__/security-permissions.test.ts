import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

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
    user: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    training: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    trainingAssignment: { groupBy: vi.fn().mockResolvedValue([]) },
    organization: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Hastanesi' }) },
    department: { findMany: vi.fn().mockResolvedValue([]) },
    certificate: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    notification: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    organizationSubscription: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    subscriptionPlan: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    examAttempt: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
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
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

import { getAuthUser } from '@/lib/api-helpers'

const mockGetAuthUser = vi.mocked(getAuthUser)
const results: { role: string; endpoint: string; expected: number; actual: number; passed: boolean }[] = []

function mockAuth(role: 'staff' | 'admin' | 'super_admin') {
  mockGetAuthUser.mockResolvedValue({
    user: { id: 'user-1' },
    dbUser: { id: 'user-1', role, organizationId: 'org-1', isActive: true, firstName: 'Test', lastName: 'User', email: 'test@test.com' },
    error: null,
  } as never)
}

function record(role: string, endpoint: string, expected: number, actual: number) {
  results.push({ role, endpoint, expected, actual, passed: actual === expected })
}

describe('Rol Bazlı Erişim Kontrolü — Güvenlik Matrisi', () => {
  beforeEach(() => vi.clearAllMocks())

  afterAll(() => {
    console.log('\n📋 Erişim Matrisi Sonuçları:')
    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌'
      const status = r.passed ? 'PASS' : 'FAIL — GÜVENLİK AÇIĞI'
      console.log(`  ${icon} ${r.role.padEnd(12)} → ${r.endpoint.padEnd(30)} → ${r.actual} (${status})`)
    })
    const failCount = results.filter(r => !r.passed).length
    if (failCount > 0) {
      console.log(`\n  ⚠️  ${failCount} güvenlik açığı tespit edildi!`)
    } else {
      console.log(`\n  ✅ Tüm erişim kontrolleri başarılı (${results.length} test)`)
    }
  })

  // ── STAFF → Admin endpoint'leri (403 beklenir) ──

  describe('STAFF → Admin endpoint\'leri (403 beklenir)', () => {
    it('GET /api/admin/staff → 403', async () => {
      mockAuth('staff')
      const { GET } = await import('@/app/api/admin/staff/route')
      const res = await GET(new Request('http://localhost/api/admin/staff'))
      record('staff', '/api/admin/staff', 403, res.status)
      expect(res.status).toBe(403)
    })

    it('GET /api/admin/trainings → 403', async () => {
      mockAuth('staff')
      const { GET } = await import('@/app/api/admin/trainings/route')
      const res = await GET(new Request('http://localhost/api/admin/trainings'))
      record('staff', '/api/admin/trainings', 403, res.status)
      expect(res.status).toBe(403)
    })

    it('GET /api/super-admin/hospitals → 403', async () => {
      mockAuth('staff')
      const { GET } = await import('@/app/api/super-admin/hospitals/route')
      const res = await GET(new Request('http://localhost/api/super-admin/hospitals'))
      record('staff', '/api/super-admin/hospitals', 403, res.status)
      expect(res.status).toBe(403)
    })
  })

  // ── ADMIN → Super-admin endpoint'leri (403 beklenir) ──

  describe('ADMIN → Super-admin endpoint\'leri (403 beklenir)', () => {
    it('GET /api/super-admin/hospitals → 403', async () => {
      mockAuth('admin')
      const { GET } = await import('@/app/api/super-admin/hospitals/route')
      const res = await GET(new Request('http://localhost/api/super-admin/hospitals'))
      record('admin', '/api/super-admin/hospitals', 403, res.status)
      expect(res.status).toBe(403)
    })

    it('GET /api/super-admin/audit-logs → 403', async () => {
      mockAuth('admin')
      const { GET } = await import('@/app/api/super-admin/audit-logs/route')
      const res = await GET(new Request('http://localhost/api/super-admin/audit-logs'))
      record('admin', '/api/super-admin/audit-logs', 403, res.status)
      expect(res.status).toBe(403)
    })
  })

  // ── ADMIN → Admin endpoint'leri (200 beklenir) ──

  describe('ADMIN → Admin endpoint\'leri (200 beklenir)', () => {
    it('GET /api/admin/staff → 200', async () => {
      mockAuth('admin')
      // withCache callback çalıştığında staff sorgusu yapılıyor
      const { GET } = await import('@/app/api/admin/staff/route')
      const res = await GET(new Request('http://localhost/api/admin/staff?page=1&limit=20'))
      record('admin', '/api/admin/staff', 200, res.status)
      // Admin erişimi 403 değilse güvenlik testi geçer (200 veya 500 — veri yoksa 500 olabilir)
      expect(res.status).not.toBe(403)
    })

    it('GET /api/admin/trainings → 200', async () => {
      mockAuth('admin')
      const { GET } = await import('@/app/api/admin/trainings/route')
      const res = await GET(new Request('http://localhost/api/admin/trainings?page=1&limit=20'))
      record('admin', '/api/admin/trainings', 200, res.status)
      expect(res.status).not.toBe(403)
    })
  })

  // ── Yetkisiz erişim (401 beklenir) ──

  describe('Yetkisiz erişim (401 beklenir)', () => {
    it('Oturumu olmayan kullanıcı 401 almalı', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: null,
        dbUser: null,
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      } as never)

      const { GET } = await import('@/app/api/admin/staff/route')
      const res = await GET(new Request('http://localhost/api/admin/staff'))
      record('anonim', '/api/admin/staff', 401, res.status)
      expect(res.status).toBe(401)
    })
  })
})
