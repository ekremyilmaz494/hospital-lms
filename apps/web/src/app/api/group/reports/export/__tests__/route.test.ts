import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

// ── Mock katmanı — gerçek DB/auth'a gitmeden route'u çalıştır ──
const mockFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { organizationGroup: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } } }))

vi.mock('@/lib/redis', () => ({ checkRateLimit: async () => true }))

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/api-helpers', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-helpers')>()
  return {
    ...actual,
    getAuthUser: () => mockGetAuthUser(),
    checkWritePermission: async () => null,
    createAuditLog: async () => {}, // audit no-op (prisma mock'lu)
  }
})

vi.mock('@/lib/license/enforcement', () => ({
  licenseApiGate: async () => ({ blocked: false }),
  isReadonlyWriteExempt: () => false,
}))

// buildOrgReportFilters yalnız orgId'yi taşısın; gerçek fetchReportData mock'ta ignore edilir.
vi.mock('../../../../admin/reports/_shared', async (importActual) => {
  const actual = await importActual<typeof import('../../../../admin/reports/_shared')>()
  return { ...actual, buildOrgReportFilters: async (orgId: string) => ({ orgId }) }
})

// fetchReportData'yı deterministik yap; buildReportRows GERÇEK çalışsın (math test edilsin).
const mockFetch = vi.fn()
vi.mock('../../../../admin/reports/_report-data', async (importActual) => {
  const actual = await importActual<typeof import('../../../../admin/reports/_report-data')>()
  return { ...actual, fetchReportData: (filters: { orgId: string }) => mockFetch(filters.orgId) }
})

import { GET } from '../route'

const groupOwner = { id: 'go1', role: 'admin', organizationId: null, groupId: 'grpA', adminAccessGranted: false, mustChangePassword: false, isActive: true }

function authResult(dbUser: Record<string, unknown>) {
  return { user: { id: dbUser.id }, dbUser, error: null, organizationId: null }
}

function trainingWith(assignments: Array<{ status: string; post: number | null }>) {
  return {
    id: 't', title: 'Eğitim', examDurationMinutes: 30,
    assignments: assignments.map(a => ({
      status: a.status,
      user: { firstName: 'A', lastName: 'B', departmentRel: { name: 'D' } },
      examAttempts: a.post === null ? [] : [{ postExamScore: a.post, preExamScore: null, isPassed: a.post >= 70, status: 'completed', attemptNumber: 1 }],
    })),
    videos: [],
  }
}

// orgA: 3 atama (2 passed, 1 failed) / 5 personel · orgB: 1 atama (1 passed) / 3 personel
function dataFor(orgId: string) {
  if (orgId === 'orgA') {
    return {
      org: { name: 'Merkez', logoUrl: null },
      staffCount: 5,
      trainings: [trainingWith([{ status: 'passed', post: 90 }, { status: 'failed', post: 40 }]), trainingWith([{ status: 'passed', post: 80 }])],
      staff: [], departments: [], avgScoreResult: { _avg: { postExamScore: 70 } },
      truncated: { trainings: null, staff: null }, selectedDeptName: null,
    }
  }
  return {
    org: { name: 'Şube', logoUrl: null },
    staffCount: 3,
    trainings: [trainingWith([{ status: 'passed', post: 100 }])],
    staff: [], departments: [], avgScoreResult: { _avg: { postExamScore: 100 } },
    truncated: { trainings: null, staff: null }, selectedDeptName: null,
  }
}

const routeCtx = { params: Promise.resolve({}) } as never

beforeEach(() => {
  mockFindUnique.mockReset()
  mockGetAuthUser.mockReset()
  mockFetch.mockReset()
  mockGetAuthUser.mockResolvedValue(authResult(groupOwner))
  mockFindUnique.mockResolvedValue({
    name: 'Klinovax Grubu', logoUrl: null,
    organizations: [{ id: 'orgA', name: 'Merkez', code: 'merkez' }, { id: 'orgB', name: 'Şube', code: 'sube' }],
  })
  mockFetch.mockImplementation((orgId: string) => dataFor(orgId))
})

describe('GET /api/group/reports/export (xlsx)', () => {
  it('grup yöneticisi için N+1 sheet üretir (Grup Özeti + hastane başına 1) ve doğru içerik tipi döner', async () => {
    const req = new Request('https://x/api/group/reports/export?format=xlsx', { method: 'GET' })
    const res = await GET(req, routeCtx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')

    const buf = await res.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const names = wb.worksheets.map(w => w.name)
    expect(names[0]).toBe('Grup Özeti')
    expect(names).toContain('Merkez')
    expect(names).toContain('Şube')
    expect(wb.worksheets).toHaveLength(3) // 1 özet + 2 hastane
  })

  it('Grup Özeti TOPLAM satırı hastaneler arası doğru toplar', async () => {
    const req = new Request('https://x/api/group/reports/export?format=xlsx', { method: 'GET' })
    const res = await GET(req, routeCtx)
    const buf = await res.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const summary = wb.getWorksheet('Grup Özeti')!

    let totalRow: ExcelJS.Row | null = null
    summary.eachRow((row) => { if (String(row.getCell(1).value) === 'GRUP TOPLAMI') totalRow = row })
    expect(totalRow).not.toBeNull()
    const r = totalRow! as ExcelJS.Row
    expect(r.getCell(2).value).toBe(8)  // personel 5+3
    expect(r.getCell(3).value).toBe(3)  // aktif eğitim 2+1
    expect(r.getCell(4).value).toBe(4)  // atama 3+1
    expect(r.getCell(5).value).toBe(3)  // başarılı 2+1
    expect(r.getCell(6).value).toBe(1)  // başarısız 1+0
  })

  it('PDF formatı 200 + application/pdf döner (cover + özet + hastane bölümleri üretilir)', async () => {
    const req = new Request('https://x/api/group/reports/export?format=pdf', { method: 'GET' })
    const res = await GET(req, routeCtx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(1000) // gerçek bir PDF üretildi
  })

  it('grup yöneticisi değilse (groupId yok) 403', async () => {
    mockGetAuthUser.mockResolvedValue(authResult({ ...groupOwner, groupId: null }))
    const req = new Request('https://x/api/group/reports/export?format=xlsx', { method: 'GET' })
    const res = await GET(req, routeCtx)
    expect(res.status).toBe(403)
  })
})
