import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/trainings/[id]/staff — sunucu-taraflı sayfalama + arama + durum
 * filtresi. findMany skip/take ile çağrılmalı, where organizationId+trainingId ile
 * scope'lanmalı, status/search filtreleri uygulanmalı, flatten shape dönmeli.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: { count: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
// Prisma yalnız tip olarak kullanılıyor (runtime'da dereference edilmiyor)
vi.mock('@/generated/prisma/client', () => ({ Prisma: {} }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  safePagination: (sp: URLSearchParams) => {
    const page = Number(sp.get('page')) || 1
    const limit = Number(sp.get('limit')) || 20
    return { page, limit, skip: (page - 1) * limit }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: {
    request: Request
    params: { id: string }
    organizationId: string
  }) => Promise<Response>) => {
    return async (request: Request, ctx: { params: Promise<{ id: string }> }) =>
      handler({ request, params: await ctx.params, organizationId: 'org-1' })
  },
}))

import { GET } from '../route'

function call(id: string, qs = '') {
  return GET(
    new Request(`http://localhost/api/admin/trainings/${id}/staff${qs}`),
    { params: Promise.resolve({ id }) },
  )
}

describe('GET /api/admin/trainings/[id]/staff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.trainingAssignment.count.mockResolvedValue(1)
    prismaMock.trainingAssignment.findMany.mockResolvedValue([
      {
        id: 'a1',
        currentAttempt: 1,
        status: 'passed',
        completedAt: new Date('2026-06-01T00:00:00Z'),
        user: { id: 'u1', firstName: 'Ali', lastName: 'Veli', email: 'ali@x.com', departmentRel: { name: 'BT' } },
        examAttempts: [{
          preExamScore: 80, postExamScore: 90,
          preExamCompletedAt: new Date(), videosCompletedAt: new Date(), postExamCompletedAt: new Date(),
          signedAt: null, signatureMethod: null,
        }],
      },
    ])
  })

  it('skip/take + org/training scope ile sorgular, flatten shape döndürür', async () => {
    const res = await call('t1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.assignedStaff).toHaveLength(1)
    expect(body.assignedStaff[0]).toMatchObject({
      assignmentId: 'a1', userId: 'u1', name: 'Ali Veli', department: 'BT',
      attempt: 1, progress: 100, preScore: 80, postScore: 90, status: 'passed',
    })

    expect(prismaMock.trainingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', trainingId: 't1' }),
        skip: 0,
        take: 20,
      }),
    )
  })

  it('status=completed → where.status passed/failed in', async () => {
    await call('t1', '?status=completed')
    const arg = prismaMock.trainingAssignment.findMany.mock.calls[0][0]
    expect(arg.where.status).toEqual({ in: ['passed', 'failed'] })
  })

  it('status=incomplete → where.status in_progress/assigned in', async () => {
    await call('t1', '?status=incomplete')
    const arg = prismaMock.trainingAssignment.findMany.mock.calls[0][0]
    expect(arg.where.status).toEqual({ in: ['in_progress', 'assigned'] })
  })

  it('search → user adı/email üzerinde OR contains filtresi', async () => {
    await call('t1', '?search=ali')
    const arg = prismaMock.trainingAssignment.findMany.mock.calls[0][0]
    expect(arg.where.user).toBeDefined()
    expect(arg.where.user.OR).toHaveLength(3)
  })

  it('page=2&limit=10 → skip 10, take 10', async () => {
    await call('t1', '?page=2&limit=10')
    const arg = prismaMock.trainingAssignment.findMany.mock.calls[0][0]
    expect(arg.skip).toBe(10)
    expect(arg.take).toBe(10)
  })
})
