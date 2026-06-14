import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Admin Assignments DELETE — personeli eğitimden çıkar (unassign).
 *
 * Sözleşme:
 * - assignmentId veya userId zorunlu (yoksa 400)
 * - Tenant guard: başka kuruma ait / bulunamayan atama → 404
 * - Bulunan atama silinir (ExamAttempt cascade ile düşer), audit + cache invalidasyonu
 * - Durumdan bağımsız (passed dahil) silinebilir
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
  safePagination: () => ({ page: 1, limit: 10, skip: 0 }),
}))

const auditMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        request,
        params: await params,
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: auditMock,
      })
    }
  },
}))

vi.mock('@/lib/validations', () => ({
  createAssignmentSchema: { safeParse: (input: unknown) => ({ success: true, data: input }) },
}))
vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  trainingAssignedEmail: vi.fn().mockReturnValue('<html></html>'),
}))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/training-periods', () => ({
  getOrCreateActivePeriodForAssignment: vi.fn(),
  findActivePeriod: vi.fn(),
}))

import { DELETE } from '../assignments/route'

function deleteRequest(body: Record<string, unknown> | null): Request {
  return new Request('http://localhost/api/admin/trainings/training-1/assignments', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const ctx = { params: Promise.resolve({ id: 'training-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Admin DELETE /api/admin/trainings/[id]/assignments — unassign', () => {
  it('assignmentId/userId yoksa 400 döner', async () => {
    const res = await DELETE(deleteRequest({}), ctx)
    expect(res.status).toBe(400)
    expect(prismaMock.trainingAssignment.delete).not.toHaveBeenCalled()
  })

  it('atama bulunamazsa 404 döner, silme yapılmaz', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(null)
    const res = await DELETE(deleteRequest({ assignmentId: 'a-1' }), ctx)
    expect(res.status).toBe(404)
    expect(prismaMock.trainingAssignment.delete).not.toHaveBeenCalled()
  })

  it('tenant guard: findFirst organizationId ile scope edilir', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce({
      id: 'a-1', userId: 'u-1', status: 'in_progress', round: 1,
    })
    prismaMock.trainingAssignment.delete.mockResolvedValueOnce({ id: 'a-1' })

    await DELETE(deleteRequest({ assignmentId: 'a-1' }), ctx)

    const whereArg = prismaMock.trainingAssignment.findFirst.mock.calls[0][0].where
    expect(whereArg.organizationId).toBe('org-1')
    expect(whereArg.trainingId).toBe('training-1')
    expect(whereArg.id).toBe('a-1')
  })

  it('durumdan bağımsız (passed) atama silinir + audit/cache çağrılır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce({
      id: 'a-9', userId: 'u-9', status: 'passed', round: 2,
    })
    prismaMock.trainingAssignment.delete.mockResolvedValueOnce({ id: 'a-9' })

    const res = await DELETE(deleteRequest({ assignmentId: 'a-9' }), ctx)

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.delete).toHaveBeenCalledWith({ where: { id: 'a-9' } })
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'unassign', entityId: 'a-9' }))
  })

  it('userId ile de çıkarma yapılabilir', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce({
      id: 'a-3', userId: 'u-3', status: 'assigned', round: 1,
    })
    prismaMock.trainingAssignment.delete.mockResolvedValueOnce({ id: 'a-3' })

    const res = await DELETE(deleteRequest({ userId: 'u-3' }), ctx)

    expect(res.status).toBe(200)
    const whereArg = prismaMock.trainingAssignment.findFirst.mock.calls[0][0].where
    expect(whereArg.userId).toBe('u-3')
  })
})
