import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/attempt-requests — Tenant izolasyonu:
 *
 * Talep listesindeki (userId, trainingId) çiftleri için atama durumunu çeken
 * `trainingAssignment.findMany` sorgusu organizationId ile scope'lanmalı
 * (CLAUDE.md "her sorguda organizationId ZORUNLU"). userId/trainingId zaten
 * org-scoped taleplerden gelse de, sorgu defense-in-depth için org filtreli olmalı.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttemptRequest: { count: vi.fn(), findMany: vi.fn() },
    trainingAssignment: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  safePagination: () => ({ page: 1, limit: 50, skip: 0 }),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: {
    request: Request
    organizationId: string
  }) => Promise<Response>) => {
    return async (request: Request) => handler({ request, organizationId: 'org-1' })
  },
}))

import { GET } from '../route'

function listRequest(): Request {
  return new Request('http://localhost/api/admin/attempt-requests?status=pending')
}

describe('GET /api/admin/attempt-requests — tenant izolasyonu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.examAttemptRequest.count.mockResolvedValue(1)
    prismaMock.examAttemptRequest.findMany.mockResolvedValue([
      {
        id: 'req-1',
        status: 'pending',
        reason: 'tekrar',
        grantedAttempts: null,
        reviewNote: null,
        createdAt: new Date(),
        reviewedAt: null,
        trainingId: 'training-1',
        userId: 'user-1',
        training: { title: 'Yangın Güvenliği' },
        user: { firstName: 'A', lastName: 'B', email: 'a@b.c', departmentRel: { name: 'BT' } },
        reviewedBy: null,
      },
    ])
    prismaMock.trainingAssignment.findMany.mockResolvedValue([])
  })

  it('atama durumu sorgusu organizationId ile scope\'lanır', async () => {
    const res = await GET(listRequest())

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          userId: { in: ['user-1'] },
          trainingId: { in: ['training-1'] },
        }),
      }),
    )
  })

  it('talep yoksa atama sorgusu hiç çalışmaz (boş in listesi)', async () => {
    prismaMock.examAttemptRequest.count.mockResolvedValue(0)
    prismaMock.examAttemptRequest.findMany.mockResolvedValue([])

    const res = await GET(listRequest())

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.findMany).not.toHaveBeenCalled()
  })
})
