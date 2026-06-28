import { describe, it, expect, vi, beforeEach } from 'vitest'

// api-helpers zinciri (errorResponse) prisma/supabase import eder — yan etkileri engelle.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createBearerClient: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { department: { findFirst: vi.fn(), findMany: vi.fn() } },
}))
vi.mock('@/lib/training-periods', () => ({ findActivePeriod: vi.fn(), getPeriodById: vi.fn() }))

import { resolveReportFilters } from '../_shared'
import { prisma } from '@/lib/prisma'
import { findActivePeriod, getPeriodById } from '@/lib/training-periods'

const mFindActive = vi.mocked(findActivePeriod)
const mGetById = vi.mocked(getPeriodById)
const mDeptFirst = vi.mocked(prisma.department.findFirst)
const mDeptMany = vi.mocked(prisma.department.findMany)

const ORG = 'org-1'
const PERIOD = { id: 'p1', startDate: new Date('2026-01-01'), label: '2026 Dönemi' }
const UUID = '11111111-1111-4111-8111-111111111111'

function req(qs = '') {
  return new Request(`http://localhost/api/admin/reports${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveReportFilters — dönem çözümü (tüm rapor endpoint\'lerinin tek kaynağı)', () => {
  it('periodId yoksa aktif döneme düşer ve assignment+attempt dönem filtrelerini kurar', async () => {
    mFindActive.mockResolvedValue(PERIOD as never)
    const { filters, error } = await resolveReportFilters(req(), ORG)
    expect(error).toBeNull()
    expect(filters!.resolvedPeriodId).toBe('p1')
    expect(filters!.assignmentPeriodFilter).toEqual({ periodId: 'p1' })
    expect(filters!.attemptPeriodFilter).toEqual({ assignment: { periodId: 'p1' } })
    expect(filters!.targetPeriod?.label).toBe('2026 Dönemi')
    expect(mGetById).not.toHaveBeenCalled()
  })

  it('aktif dönem yoksa filtreler boş kalır (tüm dönemler)', async () => {
    mFindActive.mockResolvedValue(null)
    const { filters } = await resolveReportFilters(req(), ORG)
    expect(filters!.resolvedPeriodId).toBeNull()
    expect(filters!.assignmentPeriodFilter).toEqual({})
    expect(filters!.attemptPeriodFilter).toEqual({})
    expect(filters!.targetPeriod).toBeNull()
  })

  it('geçerli periodId verilince getPeriodById ile çözer, aktif döneme bakmaz', async () => {
    mGetById.mockResolvedValue({ id: UUID, startDate: new Date('2025-01-01'), label: '2025' } as never)
    const { filters } = await resolveReportFilters(req(`?periodId=${UUID}`), ORG)
    expect(mGetById).toHaveBeenCalledWith(UUID, ORG)
    expect(mFindActive).not.toHaveBeenCalled()
    expect(filters!.resolvedPeriodId).toBe(UUID)
  })

  it('yabancı/bulunamayan periodId → null (tüm dönemler), hata fırlatmaz', async () => {
    mGetById.mockRejectedValue(new Error('Eğitim dönemi bulunamadı'))
    const { filters, error } = await resolveReportFilters(req(`?periodId=${UUID}`), ORG)
    expect(error).toBeNull()
    expect(filters!.resolvedPeriodId).toBeNull()
    expect(filters!.assignmentPeriodFilter).toEqual({})
  })
})

describe('resolveReportFilters — departman izolasyonu', () => {
  it('geçerli departman → userDeptFilter kurar', async () => {
    mFindActive.mockResolvedValue(null)
    mDeptFirst.mockResolvedValue({ id: UUID } as never)
    mDeptMany.mockResolvedValue([{ id: UUID, parentId: null }] as never)
    const { filters } = await resolveReportFilters(req(`?departmentId=${UUID}`), ORG)
    expect(filters!.userDeptFilter).toEqual({ departmentId: UUID })
  })

  it('geçersiz/yabancı departman → 403 error döner (cross-tenant guard)', async () => {
    mFindActive.mockResolvedValue(null)
    mDeptFirst.mockResolvedValue(null)
    const { filters, error } = await resolveReportFilters(req(`?departmentId=${UUID}`), ORG)
    expect(filters).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.status).toBe(403)
  })
})
