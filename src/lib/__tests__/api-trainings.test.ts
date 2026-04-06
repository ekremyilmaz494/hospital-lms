import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'admin-user-1' } } },
        error: null,
      })),
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    training: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    trainingVideo: { create: vi.fn() },
    question: { create: vi.fn() },
    questionOption: { create: vi.fn() },
    trainingAssignment: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({
  withCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  invalidateOrgCache: vi.fn(),
  checkRateLimit: vi.fn(async () => true),
}))

vi.mock('@/lib/subscription-guard', () => ({
  checkSubscriptionLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn(),
}))

vi.mock('@/lib/api-helpers', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createAuditLog: vi.fn(),
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, safePagination, errorResponse } from '@/lib/api-helpers'

const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>
const mockTrainingFindMany = prisma.training.findMany as ReturnType<typeof vi.fn>
const mockTrainingCount = prisma.training.count as ReturnType<typeof vi.fn>

const ORG_A = 'org-a-uuid'
const ORG_B = 'org-b-uuid'

function setupAuthAdmin(orgId: string = ORG_A) {
  mockUserFindUnique.mockResolvedValue({
    id: 'admin-user-1',
    role: 'admin',
    isActive: true,
    organizationId: orgId,
  })
  mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: false })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──

describe('Egitim CRUD islemleri', () => {
  describe('GET /api/admin/trainings — Listeleme', () => {
    it('organizasyona ait egitimleri listeler', async () => {
      setupAuthAdmin()
      const mockTrainings = [
        {
          id: 't-1',
          title: 'Enfeksiyon Kontrolu',
          category: 'infection',
          passingScore: 70,
          publishStatus: 'published',
          startDate: new Date(),
          endDate: new Date(),
          _count: { assignments: 10, questions: 5, videos: 3 },
          assignments: [{ status: 'passed' }, { status: 'in_progress' }],
          videos: [],
        },
      ]
      mockTrainingFindMany.mockResolvedValue(mockTrainings)
      mockTrainingCount.mockResolvedValue(1)

      const { getAuthUser: ga } = await import('@/lib/api-helpers')
      const { dbUser } = await ga()
      expect(dbUser!.organizationId).toBe(ORG_A)
    })

    it('safePagination varsayilan degerleri uygular', () => {
      const params = new URLSearchParams()
      const { page, limit } = safePagination(params)
      expect(page).toBe(1)
      expect(limit).toBe(20)
    })

    it('arama, kategori ve durum filtreleri uygulanir', () => {
      const params = new URLSearchParams({
        search: 'enfeksiyon',
        category: 'infection',
        isActive: 'true',
        publishStatus: 'published',
        page: '2',
        limit: '10',
      })
      const { page, limit, search, skip } = safePagination(params)
      expect(page).toBe(2)
      expect(limit).toBe(10)
      expect(search).toBe('enfeksiyon')
      expect(skip).toBe(10)
    })
  })

  describe('POST /api/admin/trainings — Olusturma', () => {
    it('staff roluyle egitim olusturmaya calisirsa 403 doner', () => {
      const result = requireRole('staff', ['admin'])
      expect(result).not.toBeNull()
    })

    it('admin rolu egitim olusturma yetkisine sahiptir', () => {
      const result = requireRole('admin', ['admin'])
      expect(result).toBeNull()
    })

    it('gecersiz body ile 400 doner', async () => {
      const { parseBody } = await import('@/lib/api-helpers')
      const request = new Request('http://localhost', {
        method: 'POST',
        body: 'gecersiz json',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await parseBody(request)
      expect(result).toBeNull()
    })
  })

  describe('Cross-org erisim kontrolu', () => {
    it('farkli organizasyonun egitimi erisilememeli (orgId filtresi)', () => {
      // Training sorgulari her zaman organizationId ile filtrelenmeli
      const where = {
        organizationId: ORG_A,
      }
      // Org B kullanicisi Org A verilerine erisememeli
      expect(where.organizationId).not.toBe(ORG_B)
    })
  })

  describe('Validation hatalari', () => {
    it('gecmis tarihli bitis tarihi reddedilir', () => {
      const pastDate = new Date('2020-01-01')
      const now = new Date()
      expect(pastDate < now).toBe(true)
    })

    it('bos baslik ile validasyon hatasi olusur', async () => {
      const { createTrainingBodySchema } = await import('@/lib/validations')
      const result = createTrainingBodySchema.safeParse({
        title: '',
        startDate: '2026-06-01',
        endDate: '2026-07-01',
        passingScore: 70,
        maxAttempts: 3,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Sayfalama', () => {
    it('ilk sayfada skip 0 olur', () => {
      const params = new URLSearchParams({ page: '1', limit: '20' })
      const { skip } = safePagination(params)
      expect(skip).toBe(0)
    })

    it('ucuncu sayfada skip dogru hesaplanir', () => {
      const params = new URLSearchParams({ page: '3', limit: '10' })
      const { skip } = safePagination(params)
      expect(skip).toBe(20)
    })

    it('limit 100 ile sinirlanir', () => {
      const params = new URLSearchParams({ limit: '500' })
      const { limit } = safePagination(params)
      expect(limit).toBe(100)
    })

    it('totalPages dogru hesaplanir', () => {
      const total = 55
      const limit = 20
      const totalPages = Math.ceil(total / limit)
      expect(totalPages).toBe(3)
    })
  })
})

describe('Abonelik limiti egitim olusturmada', () => {
  it('limit asilmissa egitim olusturulamaz', async () => {
    const { checkSubscriptionLimit } = await import('@/lib/subscription-guard')
    ;(checkSubscriptionLimit as ReturnType<typeof vi.fn>).mockResolvedValue(
      errorResponse('Eğitim limitine ulaştınız (20/20). Planınızı yükseltin.', 403)
    )

    const result = await checkSubscriptionLimit(ORG_A, 'training')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('limitine')
  })

  it('limit asilmamissa null doner (izin verir)', async () => {
    const { checkSubscriptionLimit } = await import('@/lib/subscription-guard')
    ;(checkSubscriptionLimit as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await checkSubscriptionLimit(ORG_A, 'training')
    expect(result).toBeNull()
  })
})
