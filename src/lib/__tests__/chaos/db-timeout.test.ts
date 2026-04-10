/**
 * Chaos Test: Veritabanı yavaşladığında veya timeout olduğunda davranış.
 * API endpoint'leri Prisma hatalarını yakalayıp kullanıcıya uygun mesaj dönmeli.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(() => null),
  jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
  errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  createAuditLog: vi.fn(),
  parseBody: vi.fn(),
  computeAuditHash: vi.fn().mockReturnValue('hash'),
  safePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}))

// DB timeout simülasyonu — Prisma hata fırlatır
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockRejectedValue(new Error('Connection timed out')),
      count: vi.fn().mockRejectedValue(new Error('Connection timed out')),
    },
    training: {
      findMany: vi.fn().mockRejectedValue(new Error('Connection timed out')),
      count: vi.fn().mockRejectedValue(new Error('Connection timed out')),
    },
    trainingAssignment: { groupBy: vi.fn().mockRejectedValue(new Error('Connection timed out')) },
    department: { findMany: vi.fn().mockRejectedValue(new Error('Connection timed out')) },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn(),
  withCache: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => { try { return await fn() } catch { return null } }),
  invalidateCache: vi.fn(),
  invalidateOrgCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), withRequestId: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/dashboard-cache', () => ({ invalidateDashboardCache: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ encrypt: vi.fn((v: string) => v), decrypt: vi.fn((v: string) => v), safeDecryptTcNo: vi.fn((v: string | null) => v) }))

import { getAuthUser } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const mockGetAuthUser = vi.mocked(getAuthUser)

function mockAdmin() {
  mockGetAuthUser.mockResolvedValue({
    user: { id: 'admin-1' },
    dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1', isActive: true },
    error: null,
  } as never)
}

describe('Chaos: Veritabanı Timeout / Bağlantı Hatası', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Staff endpoint DB timeout olduğunda uygulama çökmemeli', async () => {
    mockAdmin()
    const { GET } = await import('@/app/api/admin/staff/route')
    // DB hata fırlatacak — withCache null döner, route devam eder
    const res = await GET(new Request('http://localhost/api/admin/staff?page=1&limit=20'))
    // Uygulama çökmedi — bir response döndü (200 veya 500)
    expect(res).toBeDefined()
    expect(typeof res.status).toBe('number')
  })

  it('Trainings endpoint DB timeout olduğunda uygulama çökmemeli', async () => {
    mockAdmin()
    const { GET } = await import('@/app/api/admin/trainings/route')
    const res = await GET(new Request('http://localhost/api/admin/trainings?page=1&limit=20'))
    expect(res).toBeDefined()
    expect(typeof res.status).toBe('number')
  })

  it('DB hatası response body üzerinden iç detay sızdırmamalı', async () => {
    mockAdmin()
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET(new Request('http://localhost/api/admin/staff?page=1&limit=20'))
    const body = await res.json()
    // "Connection timed out" gibi iç hata mesajı kullanıcıya gösterilmemeli
    expect(JSON.stringify(body)).not.toContain('Connection timed out')
  })

  it('DB timeout durumunda response hala geçerli JSON olmalı', async () => {
    mockAdmin()
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET(new Request('http://localhost/api/admin/staff?page=1&limit=20'))
    // JSON parse edilebilmeli — bozuk response olmamalı
    const body = await res.json()
    expect(body).toBeDefined()
  })
})
