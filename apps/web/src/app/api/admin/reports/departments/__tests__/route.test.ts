import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * reports/departments — ortak personel (çok-hastaneli grup) kanalizasyonu regresyon kilidi.
 *
 * Kritik iki davranış:
 *  1) Departman personel sayısı = PRIMARY kadro (User.departmentId) + ORTAK üye (membership.departmentId),
 *     disjoint invariant → çift saymaz.
 *  2) Ortak doktorun atama/skor grupları B departmanına (ÜYELİĞİN departmentId'si) atanır — PRIMARY (org A)
 *     departmanına ASLA değil. Aksi halde ya B raporundan düşer ya yanlış departmana yazılır.
 */

const mockDeptFindMany = vi.fn()
const mockUserGroupBy = vi.fn()
const mockMembershipGroupBy = vi.fn()
const mockAssignmentGroupBy = vi.fn()
const mockAttemptGroupBy = vi.fn()
const mockUserFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    department: { findMany: (...a: unknown[]) => mockDeptFindMany(...a) },
    user: { groupBy: (...a: unknown[]) => mockUserGroupBy(...a), findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    organizationMembership: { groupBy: (...a: unknown[]) => mockMembershipGroupBy(...a) },
    trainingAssignment: { groupBy: (...a: unknown[]) => mockAssignmentGroupBy(...a) },
    examAttempt: { groupBy: (...a: unknown[]) => mockAttemptGroupBy(...a) },
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (fn: (ctx: unknown) => unknown) => (req: Request) =>
    fn({ request: req, organizationId: 'orgB', dbUser: { id: 'admin', organizationId: 'orgB' }, audit: vi.fn() }),
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    new Response(JSON.stringify(data), { status, headers }),
  errorResponse: (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status }),
}))

const mockResolveFilters = vi.fn()
vi.mock('../../_shared', () => ({
  resolveReportFilters: (...a: unknown[]) => mockResolveFilters(...a),
  REPORTS_CACHE_HEADERS: {},
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { GET } from '../route'

const EMPTY_FILTERS = {
  userDeptFilter: {},
  assignmentDateFilter: {},
  attemptDateFilter: {},
  trainingScope: { organizationId: 'orgB' },
  departmentId: undefined,
  assignmentPeriodFilter: {},
  attemptPeriodFilter: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveFilters.mockResolvedValue({ error: null, filters: EMPTY_FILTERS })
})

function run() {
  return GET(new Request('https://x/api/admin/reports/departments'))
}

describe('GET /api/admin/reports/departments — ortak personel kanalizasyonu', () => {
  it('personel sayısı = PRIMARY kadro + ORTAK üye (merge, çift saymaz)', async () => {
    mockDeptFindMany.mockResolvedValue([{ id: 'depB1', name: 'Kardiyoloji', color: '#f00' }])
    mockUserGroupBy.mockResolvedValue([{ departmentId: 'depB1', _count: { _all: 3 } }]) // 3 primary staff
    mockMembershipGroupBy.mockResolvedValue([{ departmentId: 'depB1', _count: { _all: 2 } }]) // 2 ortak doktor
    mockAssignmentGroupBy.mockResolvedValue([])
    mockAttemptGroupBy.mockResolvedValue([])
    mockUserFindMany.mockResolvedValue([])

    const res = await run()
    expect(res.status).toBe(200)
    const { departmentData } = await res.json()
    const kardiyoloji = departmentData.find((d: { dept: string }) => d.dept === 'Kardiyoloji')
    expect(kardiyoloji.personel).toBe(5) // 3 primary + 2 üye
  })

  it('ortak doktorun atama/skoru ÜYELİK departmanına (B) atanır, primary (A) departmanına DEĞİL', async () => {
    mockDeptFindMany.mockResolvedValue([
      { id: 'depB1', name: 'B-Kardiyoloji', color: '#f00' }, // ortak doktorun B üyelik departmanı
      { id: 'depB2', name: 'B-Dahiliye', color: '#0f0' },
    ])
    mockUserGroupBy.mockResolvedValue([])
    mockMembershipGroupBy.mockResolvedValue([{ departmentId: 'depB1', _count: { _all: 1 } }])
    // Ortak doktor 'shared' 1 passed atama + 80 puan
    mockAssignmentGroupBy.mockResolvedValue([{ userId: 'shared', status: 'passed', _count: { _all: 1 } }])
    mockAttemptGroupBy.mockResolvedValue([{ userId: 'shared', _avg: { postExamScore: 80 }, _count: { postExamScore: 1 } }])
    // shared: primary org A, primary dept 'depA-KALP' (org A) — AMA B üyeliği depB1'de
    mockUserFindMany.mockResolvedValue([
      { id: 'shared', organizationId: 'orgA', departmentId: 'depA-KALP', memberships: [{ departmentId: 'depB1' }] },
    ])

    const res = await run()
    const { departmentData } = await res.json()
    const b1 = departmentData.find((d: { dept: string }) => d.dept === 'B-Kardiyoloji')
    // Atama+skor B-Kardiyoloji'ye (üyelik dept) düştü:
    expect(b1.tamamlanma).toBe(100) // 1 passed / 1 total
    expect(b1.ortPuan).toBe(80)
    // Ortak doktorun PRIMARY (A) departmanı sonuçta HİÇ yok (B raporuna sızmadı):
    expect(departmentData.every((d: { dept: string }) => d.dept !== 'depA-KALP')).toBe(true)
  })

  it('primary personel için departman User.departmentId\'den çözülür', async () => {
    mockDeptFindMany.mockResolvedValue([{ id: 'depB2', name: 'B-Dahiliye', color: '#0f0' }])
    mockUserGroupBy.mockResolvedValue([{ departmentId: 'depB2', _count: { _all: 1 } }])
    mockMembershipGroupBy.mockResolvedValue([])
    mockAssignmentGroupBy.mockResolvedValue([{ userId: 'prim', status: 'passed', _count: { _all: 1 } }])
    mockAttemptGroupBy.mockResolvedValue([])
    // prim: primary org B → User.departmentId (depB2) kullanılır, üyelik yok
    mockUserFindMany.mockResolvedValue([
      { id: 'prim', organizationId: 'orgB', departmentId: 'depB2', memberships: [] },
    ])

    const res = await run()
    const { departmentData } = await res.json()
    const b2 = departmentData.find((d: { dept: string }) => d.dept === 'B-Dahiliye')
    expect(b2.personel).toBe(1)
    expect(b2.tamamlanma).toBe(100)
  })
})
