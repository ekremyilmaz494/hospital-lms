import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prisma mock — staff lookup + department + membership create/delete.
const mockUserFindFirst = vi.fn()
const mockDeptFindFirst = vi.fn()
const mockMembershipCreate = vi.fn()
const mockMembershipDeleteMany = vi.fn()
const mockMembershipFindMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
    organizationMembership: {
      create: (...a: unknown[]) => mockMembershipCreate(...a),
      deleteMany: (...a: unknown[]) => mockMembershipDeleteMany(...a),
      findMany: (...a: unknown[]) => mockMembershipFindMany(...a),
    },
  },
}))

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/api-helpers', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-helpers')>()
  return {
    ...actual,
    getAuthUser: () => mockGetAuthUser(),
    checkWritePermission: async () => null,
    createAuditLog: async () => {},
  }
})

const mockCheckStaffLimit = vi.fn()
vi.mock('@/lib/subscription-guard', () => ({ checkStaffLimit: (...a: unknown[]) => mockCheckStaffLimit(...a) }))

const mockOrgInGroup = vi.fn()
vi.mock('@/lib/auth/group-drill-in', () => ({ orgInOwnerGroup: (...a: unknown[]) => mockOrgInGroup(...a) }))

const mockVerifyToken = vi.fn()
vi.mock('@/lib/auth/acting-org', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/auth/acting-org')>()
  return { ...actual, verifyActingOrgToken: (...a: unknown[]) => mockVerifyToken(...a) }
})

vi.mock('@/lib/license/enforcement', () => ({ licenseApiGate: async () => ({ blocked: false }), isReadonlyWriteExempt: () => false }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: async () => true, invalidateOrgCache: async () => {} }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { POST, DELETE } from '../route'

const SRC = '11111111-1111-4111-8111-111111111111'    // kaynak hastane (personelin primary org'u)
const TARGET = '22222222-2222-4222-8222-222222222222' // grup-içi hedef hastane (UUID — schema uuid ister)
const groupOwner = { id: 'go1', role: 'admin', organizationId: null, groupId: 'grpA', adminAccessGranted: false, mustChangePassword: false, isActive: true }
const plainAdmin = { id: 'a1', role: 'admin', organizationId: SRC, groupId: null, adminAccessGranted: false, mustChangePassword: false, isActive: true }

function authResult(dbUser: Record<string, unknown>) {
  return { user: { id: dbUser.id }, dbUser, error: null, organizationId: (dbUser.organizationId as string) ?? null }
}
function req(body: unknown, method = 'POST') {
  return new Request('https://x/api/admin/staff/s1/memberships', {
    method, headers: { cookie: 'klx-acting-org=fake', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const ctx = { params: Promise.resolve({ id: 's1' }) } as never

beforeEach(() => {
  vi.clearAllMocks()
  // Grup yöneticisi orgA'ya drill-in yapmış (effectiveOrgId=orgA); orgA + orgB grupta.
  mockGetAuthUser.mockResolvedValue(authResult(groupOwner))
  mockVerifyToken.mockReturnValue(SRC)
  mockOrgInGroup.mockResolvedValue(true) // varsayılan: hedef grupta + aktif
  mockUserFindFirst.mockResolvedValue({ id: 's1', organizationId: SRC, firstName: 'Ali', lastName: 'V' })
  mockCheckStaffLimit.mockResolvedValue(null) // seat müsait
  mockMembershipCreate.mockResolvedValue({ id: 'm1', organizationId: TARGET, departmentId: null, title: null })
})

describe('POST /api/admin/staff/[id]/memberships — ortak personel provizyonu', () => {
  it('grup yöneticisi grup-içi hedefe personel ekler → 201 + seat kontrol edilir', async () => {
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(201)
    expect(mockCheckStaffLimit).toHaveBeenCalledWith(TARGET, 1)
    expect(mockMembershipCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 's1', organizationId: TARGET, role: 'staff' }),
    }))
  })

  it('GÜVENLİK: sıradan hastane admini (groupId yok) → 403', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(plainAdmin))
    mockVerifyToken.mockReturnValue(undefined) // plain admin acting yok → kendi org'u
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(403)
    expect(mockMembershipCreate).not.toHaveBeenCalled()
  })

  it('hedef = personelin primary org\'u → 400 (disjoint invariant)', async () => {
    const res = await POST(req({ organizationId: SRC }), ctx)
    expect(res.status).toBe(400)
    expect(mockMembershipCreate).not.toHaveBeenCalled()
  })

  it('GÜVENLİK: hedef grup-DIŞI/askıda → 403', async () => {
    // orgA (acting) grupta true; hedef orgB false.
    mockOrgInGroup.mockImplementation((org: string) => Promise.resolve(org === SRC))
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(403)
    expect(mockMembershipCreate).not.toHaveBeenCalled()
  })

  it('hedef org seat limiti dolu → 403 (checkStaffLimit bloğu döner)', async () => {
    mockCheckStaffLimit.mockResolvedValue(new Response(JSON.stringify({ error: 'dolu', code: 'STAFF_LIMIT_REACHED' }), { status: 403 }))
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(403)
    expect(mockMembershipCreate).not.toHaveBeenCalled()
  })

  it('zaten üye (unique ihlali P2002) → 409', async () => {
    mockMembershipCreate.mockRejectedValue({ code: 'P2002' })
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(409)
  })

  it('personel kaynak hastanede yok → 404', async () => {
    mockUserFindFirst.mockResolvedValue(null)
    const res = await POST(req({ organizationId: TARGET }), ctx)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/staff/[id]/memberships — üyelik kaldırma', () => {
  it('grup yöneticisi üyeliği kaldırır → 200', async () => {
    mockMembershipDeleteMany.mockResolvedValue({ count: 1 })
    const res = await DELETE(req({ organizationId: TARGET }, 'DELETE'), ctx)
    expect(res.status).toBe(200)
    expect(mockMembershipDeleteMany).toHaveBeenCalledWith({ where: { userId: 's1', organizationId: TARGET } })
  })

  it('üyelik yoksa → 404', async () => {
    mockMembershipDeleteMany.mockResolvedValue({ count: 0 })
    const res = await DELETE(req({ organizationId: TARGET }, 'DELETE'), ctx)
    expect(res.status).toBe(404)
  })
})
