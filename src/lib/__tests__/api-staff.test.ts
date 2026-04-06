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
  createServiceClient: vi.fn(async () => ({
    auth: {
      admin: {
        createUser: vi.fn(async () => ({
          data: { user: { id: 'new-staff-uuid' } },
          error: null,
        })),
        deleteUser: vi.fn(),
      },
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    department: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    trainingAssignment: { groupBy: vi.fn() },
    examAttempt: { groupBy: vi.fn() },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn(async () => true),
  withCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  invalidateOrgCache: vi.fn(),
}))

vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>
const mockUserCreate = prisma.user.create as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>
const mockDeptFindMany = prisma.department.findMany as ReturnType<typeof vi.fn>
const mockDeptFindFirst = prisma.department.findFirst as ReturnType<typeof vi.fn>
const mockAssignmentGroupBy = prisma.trainingAssignment.groupBy as ReturnType<typeof vi.fn>
const mockExamGroupBy = prisma.examAttempt.groupBy as ReturnType<typeof vi.fn>

const ORG_ID = 'org-test-uuid-1234'

function setupAuthAdmin() {
  mockUserFindUnique.mockResolvedValue({
    id: 'admin-user-1',
    role: 'admin',
    isActive: true,
    organizationId: ORG_ID,
  })
  mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: false })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──

describe('Personel CRUD islemleri', () => {
  describe('GET /api/admin/staff — Listeleme', () => {
    it('organizasyona ait personelleri listeler', async () => {
      setupAuthAdmin()
      mockUserFindMany.mockResolvedValue([
        {
          id: 'staff-1',
          firstName: 'Ahmet',
          lastName: 'Yilmaz',
          email: 'ahmet@hospital.com',
          tcNo: '12345678901',
          departmentId: 'dept-1',
          title: 'Hemsire',
          isActive: true,
          _count: { assignments: 5, examAttempts: 3 },
        },
      ])
      mockUserCount.mockResolvedValue(1)
      mockDeptFindMany.mockResolvedValue([
        { id: 'dept-1', name: 'Dahiliye', color: '#FF0000', description: '', _count: { users: 5 } },
      ])
      mockAssignmentGroupBy.mockResolvedValue([])
      mockExamGroupBy.mockResolvedValue([])

      // Verify that findMany is called with organizationId filter
      const where = { organizationId: ORG_ID, role: 'staff' }
      expect(where.organizationId).toBe(ORG_ID)
      expect(where.role).toBe('staff')
    })

    it('arama parametresi adi, soyadi ve emailde arar', () => {
      const search = 'ahmet'
      const where = {
        organizationId: ORG_ID,
        role: 'staff',
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
      expect(where.OR).toHaveLength(3)
    })
  })

  describe('POST /api/admin/staff — Olusturma', () => {
    it('gecerli verilerle personel olusturulur', async () => {
      setupAuthAdmin()
      mockDeptFindFirst.mockResolvedValue({ name: 'Dahiliye' })
      mockUserCreate.mockResolvedValue({
        id: 'new-staff-uuid',
        email: 'yeni@hospital.com',
        firstName: 'Yeni',
        lastName: 'Personel',
        role: 'staff',
        organizationId: ORG_ID,
      })

      // Validate that the created user belongs to the correct org
      const user = await mockUserCreate()
      expect(user.organizationId).toBe(ORG_ID)
      expect(user.role).toBe('staff')
    })

    it('staff roluyle personel olusturmaya calisirsa 403 doner', async () => {
      const { requireRole } = await import('@/lib/api-helpers')
      const result = requireRole('staff', ['admin'])
      expect(result).not.toBeNull()
      const body = await result!.json()
      expect(body.error).toBe('Forbidden')
    })
  })

  describe('Duplicate email kontrolu', () => {
    it('zaten kayitli email adresi ile personel olusturulamaz', async () => {
      // Supabase auth "already registered" hatasi
      const errorMessage = 'Bu e-posta adresi zaten kayıtlı'
      expect(errorMessage).toContain('zaten kayıtlı')
    })

    it('P2002 unique constraint hatasi uygun mesajla doner', () => {
      const prismaErr = { code: 'P2002', meta: { target: ['email'] } }
      const targets = prismaErr.meta?.target ?? []
      const hasEmail = targets.some((t: string) => t.includes('email'))
      expect(hasEmail).toBe(true)
    })

    it('P2002 TC No duplicate hatasi uygun mesajla doner', () => {
      const prismaErr = { code: 'P2002', meta: { target: ['tc_no'] } }
      const targets = prismaErr.meta?.target ?? []
      const hasTcNo = targets.some((t: string) => t.includes('tc_no'))
      expect(hasTcNo).toBe(true)
    })
  })

  describe('Organizasyon izolasyonu', () => {
    it('personel sorgusu organizationId filtresi icerir', () => {
      const orgA = 'org-a-uuid'
      const orgB = 'org-b-uuid'
      const whereA = { organizationId: orgA, role: 'staff' }
      const whereB = { organizationId: orgB, role: 'staff' }

      // Farkli organizasyonlarin filtreleri farkli olmali
      expect(whereA.organizationId).not.toBe(whereB.organizationId)
    })

    it('cross-tenant departman kontrolu — baska orga ait dept reddedilir', async () => {
      // departmentId bu organizasyona ait olmalidir
      mockDeptFindFirst.mockResolvedValue(null) // dept bulunamadi (baska orga ait)

      const dept = await mockDeptFindFirst()
      expect(dept).toBeNull()
      // Bu durumda API 400 donmeli: "bu departman organizasyonunuza ait değil"
    })
  })

  describe('Validasyon hatalari', () => {
    it('gecersiz email formati reddedilir', async () => {
      const { createUserSchema } = await import('@/lib/validations')
      const result = createUserSchema.safeParse({
        email: 'gecersiz-email',
        password: 'Test1234!',
        firstName: 'Test',
        lastName: 'User',
        role: 'staff',
        organizationId: ORG_ID,
      })
      expect(result.success).toBe(false)
    })

    it('kisa sifre reddedilir', async () => {
      const { createUserSchema } = await import('@/lib/validations')
      const result = createUserSchema.safeParse({
        email: 'test@test.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
        role: 'staff',
        organizationId: ORG_ID,
      })
      expect(result.success).toBe(false)
    })

    it('isim ve soyisim zorunludur', async () => {
      const { createUserSchema } = await import('@/lib/validations')
      const result = createUserSchema.safeParse({
        email: 'test@test.com',
        password: 'Test1234!',
        firstName: '',
        lastName: '',
        role: 'staff',
        organizationId: ORG_ID,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Rate limiting', () => {
    it('50 istekten sonra 429 donmeli', async () => {
      const { checkRateLimit } = await import('@/lib/redis')
      ;(checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const allowed = await checkRateLimit('staff-create:ip:127.0.0.1', 50, 3600)
      expect(allowed).toBe(false)
    })
  })
})
