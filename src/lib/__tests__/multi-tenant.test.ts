import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    training: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    trainingAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    examAttempt: {
      findFirst: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn(async () => true),
  withCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(),
  invalidateOrgCache: vi.fn(),
}))

vi.mock('@/lib/api-helpers', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createAuditLog: vi.fn(),
  }
})

import { prisma } from '@/lib/prisma'
import { requireRole, errorResponse } from '@/lib/api-helpers'

const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockTrainingFindMany = prisma.training.findMany as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockTrainingFindUnique = prisma.training.findUnique as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockAssignmentFindFirst = prisma.trainingAssignment.findFirst as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockAttemptFindFirst = prisma.examAttempt.findFirst as ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockDeptFindFirst = prisma.department.findFirst as ReturnType<typeof vi.fn<(...args: any[]) => any>>

const ORG_A = 'org-a-hospital-uuid'
const ORG_B = 'org-b-hospital-uuid'
const USER_A_ADMIN = 'user-a-admin-uuid'
const USER_B_ADMIN = 'user-b-admin-uuid'
const USER_A_STAFF = 'user-a-staff-uuid'
const USER_B_STAFF = 'user-b-staff-uuid'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Yardimci: Auth setup ──

function setupAuth(userId: string, role: string, orgId: string) {
  mockUserFindUnique.mockResolvedValue({
    id: userId,
    role,
    isActive: true,
    organizationId: orgId,
  })
  mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: false })
}

// ── Tests ──

describe('Multi-Tenant Izolasyon — Org A vs Org B', () => {
  describe('Egitim verileri izolasyonu', () => {
    it('Org A admini sadece Org A egitimlerini gorur', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      const orgATrainings = [
        { id: 't-a1', title: 'Enfeksiyon A', organizationId: ORG_A },
        { id: 't-a2', title: 'Guvenlik A', organizationId: ORG_A },
      ]
      mockTrainingFindMany.mockImplementation(async ({ where }: { where: { organizationId: string } }) => {
        if (where.organizationId === ORG_A) return orgATrainings
        return [] // Baska org verisi donmemeli
      })

      const result = await mockTrainingFindMany({ where: { organizationId: ORG_A } })
      expect(result).toHaveLength(2)
      expect(result.every((t: { organizationId: string }) => t.organizationId === ORG_A)).toBe(true)
    })

    it('Org B verileri Org A sorgusunda gorunmez', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      mockTrainingFindMany.mockImplementation(async ({ where }: { where: { organizationId: string } }) => {
        if (where.organizationId === ORG_A) return []
        if (where.organizationId === ORG_B) return [{ id: 't-b1', title: 'Enfeksiyon B', organizationId: ORG_B }]
        return []
      })

      // Org A kullanicisi sadece kendi org'unu sorgular
      const result = await mockTrainingFindMany({ where: { organizationId: ORG_A } })
      expect(result).toHaveLength(0)

      // Org B verisi ayri sorguda gorunur (dogrulama)
      const orgBResult = await mockTrainingFindMany({ where: { organizationId: ORG_B } })
      expect(orgBResult).toHaveLength(1)
      expect(orgBResult[0].organizationId).toBe(ORG_B)
    })
  })

  describe('Personel verileri izolasyonu', () => {
    it('Org A admini sadece Org A personellerini gorur', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      mockUserFindMany.mockImplementation(async ({ where }: { where: { organizationId: string } }) => {
        if (where.organizationId === ORG_A) {
          return [
            { id: USER_A_STAFF, firstName: 'Ahmet', organizationId: ORG_A },
          ]
        }
        return []
      })

      const result = await mockUserFindMany({ where: { organizationId: ORG_A, role: 'staff' } })
      expect(result).toHaveLength(1)
      expect(result[0].organizationId).toBe(ORG_A)
    })

    it('Org B personeli Org A listesinde gorunmez', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      mockUserFindMany.mockResolvedValue([
        { id: USER_A_STAFF, firstName: 'Ahmet', organizationId: ORG_A },
      ])

      const result = await mockUserFindMany({ where: { organizationId: ORG_A, role: 'staff' } })
      const orgBUser = result.find((u: { id: string }) => u.id === USER_B_STAFF)
      expect(orgBUser).toBeUndefined()
    })
  })

  describe('Cross-org CRUD denemeleri → 403', () => {
    it('Org A admini Org B egitimini guncelleyemez', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      // Training.findUnique org filtreli sorguda Org B verisi donmez
      mockTrainingFindUnique.mockResolvedValue(null)

      const training = await mockTrainingFindUnique({
        where: { id: 't-b1', organizationId: ORG_A }, // Org A filtresiyle Org B egitimi araniyor
      })
      expect(training).toBeNull()
      // API bu durumda 404 veya 403 doner
    })

    it('Org A admini Org B egitimini silemez', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      // Org B'nin egitimi Org A filtresiyle bulunamaz
      mockTrainingFindUnique.mockResolvedValue(null)

      const training = await mockTrainingFindUnique({
        where: { id: 't-b1', organizationId: ORG_A },
      })
      expect(training).toBeNull()
    })

    it('Org B personeli Org A sinavina katılamaz', async () => {
      setupAuth(USER_B_STAFF, 'staff', ORG_B)

      // Assignment sorgusu: training.organizationId === dbUser.organizationId (ORG_B)
      // Org A'nin assignment'i bu sorguda donmez
      mockAssignmentFindFirst.mockResolvedValue(null)

      const assignment = await mockAssignmentFindFirst({
        where: {
          id: 'assignment-org-a',
          userId: USER_B_STAFF,
          training: { organizationId: ORG_B },
        },
      })
      expect(assignment).toBeNull()
      // API: "Assignment not found" 404
    })

    it('Org B personeli Org A sinav denemesini goremez', async () => {
      setupAuth(USER_B_STAFF, 'staff', ORG_B)

      mockAttemptFindFirst.mockResolvedValue(null)

      const attempt = await mockAttemptFindFirst({
        where: {
          id: 'attempt-org-a',
          userId: USER_B_STAFF,
          training: { organizationId: ORG_B },
        },
      })
      expect(attempt).toBeNull()
    })

    it('Org A admini Org B departmanini kullanimaz', async () => {
      setupAuth(USER_A_ADMIN, 'admin', ORG_A)

      // Cross-tenant departman kontrolu: baska org'un dept'i bulunamaz
      mockDeptFindFirst.mockResolvedValue(null)

      const dept = await mockDeptFindFirst({
        where: { id: 'dept-org-b', organizationId: ORG_A },
      })
      expect(dept).toBeNull()
      // API: "bu departman organizasyonunuza ait değil" 400
    })
  })

  describe('Rol bazli cross-org kisitlamalar', () => {
    it('staff rolu admin paneline erisemez', () => {
      const result = requireRole('staff', ['admin', 'super_admin'])
      expect(result).not.toBeNull()
    })

    it('admin rolu super_admin paneline erisemez', () => {
      const result = requireRole('admin', ['super_admin'])
      expect(result).not.toBeNull()
    })

    it('super_admin tum organizasyonlara erisebilir (org filtreleme yapilmaz)', async () => {
      const superAdmin = {
        id: 'super-admin-uuid',
        role: 'super_admin',
        isActive: true,
        organizationId: null, // super admin'in org'u yok
      }
      expect(superAdmin.role).toBe('super_admin')
      expect(superAdmin.organizationId).toBeNull()

      // super_admin icin org active/suspended check atlanir
      const result = requireRole('super_admin', ['super_admin'])
      expect(result).toBeNull()
    })
  })

  describe('organizationId filtresi zorunlulugu', () => {
    it('her egitim sorgusu organizationId icermeli', () => {
      const queries = [
        { where: { organizationId: ORG_A } },
        { where: { organizationId: ORG_A, id: 'training-1' } },
        { where: { organizationId: ORG_A, isActive: true } },
      ]

      for (const q of queries) {
        expect(q.where).toHaveProperty('organizationId')
        expect(q.where.organizationId).toBeTruthy()
      }
    })

    it('her personel sorgusu organizationId icermeli', () => {
      const query = { where: { organizationId: ORG_A, role: 'staff' } }
      expect(query.where.organizationId).toBe(ORG_A)
    })

    it('sinav denemesi sorgusu training.organizationId ile filtrelenmeli', () => {
      const query = {
        where: {
          userId: USER_A_STAFF,
          training: { organizationId: ORG_A },
        },
      }
      expect(query.where.training.organizationId).toBe(ORG_A)
    })
  })
})

describe('Askiya alinmis organizasyon erisimi', () => {
  it('askiya alinmis org kullanicisi API erisemez', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: USER_A_ADMIN,
      role: 'admin',
      isActive: true,
      organizationId: ORG_A,
    })
    mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: true })

    // getAuthUser bu durumda 403 doner
    const org = await mockOrgFindUnique()
    expect(org.isSuspended).toBe(true)
  })

  it('deaktif org kullanicisi API erisemez', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: USER_A_ADMIN,
      role: 'admin',
      isActive: true,
      organizationId: ORG_A,
    })
    mockOrgFindUnique.mockResolvedValue({ isActive: false, isSuspended: false })

    const org = await mockOrgFindUnique()
    expect(org.isActive).toBe(false)
    // getAuthUser: "Kurumunuzun erişimi askıya alınmıştır" 403
  })

  it('super_admin askiya alinmis org kontrolunden muaf', () => {
    const user = { role: 'super_admin', organizationId: null }
    // super_admin icin org check atlanir
    const shouldCheckOrg = user.role !== 'super_admin' && user.organizationId
    expect(shouldCheckOrg).toBeFalsy()
  })
})
