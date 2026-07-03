import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/integration/runs — senkron koşusu listesi.
 *
 * Kritik güvenceler:
 *  - Feature gate kapalıysa 403.
 *  - Liste org-scoped (count + findMany her ikisi de).
 *  - Sayfalama: limit 100 ile sınırlanır, count+rows Promise.all.
 */

const { prismaMock, checkFeatureMock } = vi.hoisted(() => ({
  prismaMock: {
    syncRun: { count: vi.fn(), findMany: vi.fn() },
  },
  checkFeatureMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  // Gerçek safePagination davranışının birebir kopyası (api-helpers.ts)
  safePagination: (params: URLSearchParams, maxLimit = 100) => {
    const page = Math.max(Number(params.get('page') || '1'), 1)
    const limit = Math.min(Math.max(Number(params.get('limit') || '20'), 1), maxLimit)
    return { page, limit, search: '', skip: (page - 1) * limit }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: {
      request: Request
      params: Record<string, string>
      dbUser: { id: string }
      organizationId: string
      audit: (p: unknown) => Promise<void>
    }) => Promise<Response>,
  ) =>
    async (request: Request) =>
      handler({
        request,
        params: {},
        dbUser: { id: 'admin-1' },
        organizationId: 'org-1',
        audit: () => Promise.resolve(),
      }),
}))

import { GET } from '../route'

function runRow(id: string) {
  return {
    id,
    integrationId: 'int-1',
    channel: 'file',
    trigger: 'file',
    mode: 'apply',
    syncMode: 'snapshot',
    status: 'completed',
    totalRows: 100,
    createdRows: 5,
    updatedRows: 90,
    deactivatedRows: 2,
    reactivatedRows: 1,
    skippedRows: 2,
    failedRows: 0,
    fileName: 'personel.xlsx',
    startedAt: new Date('2026-07-02T21:00:00Z'),
    completedAt: new Date('2026-07-02T21:00:30Z'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  prismaMock.syncRun.count.mockResolvedValue(1)
  prismaMock.syncRun.findMany.mockResolvedValue([runRow('run-1')])
})

describe('GET /api/admin/integration/runs', () => {
  it('feature kapalı → 403, DB\'ye gidilmez', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await GET(new Request('http://localhost/api/admin/integration/runs'))
    expect(res.status).toBe(403)
    expect(prismaMock.syncRun.findMany).not.toHaveBeenCalled()
  })

  it('liste ve sayım org-scoped, en yeni koşu en üstte, Cache-Control set', async () => {
    const res = await GET(new Request('http://localhost/api/admin/integration/runs'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.syncRun.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
    expect(prismaMock.syncRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        orderBy: { startedAt: 'desc' },
      }),
    )
    expect(data.runs).toHaveLength(1)
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })

  it('sayfalama parametreleri uygulanır; limit 100 ile SINIRLANIR', async () => {
    await GET(new Request('http://localhost/api/admin/integration/runs?page=3&limit=500'))

    const findArgs = prismaMock.syncRun.findMany.mock.calls[0][0]
    expect(findArgs.take).toBe(100) // 500 istendi, 100'e kırpıldı
    expect(findArgs.skip).toBe(200) // (3-1) * 100
  })

  it('select ile yalnız beklenen alanlar çekilir (errorSummary listede yok)', async () => {
    await GET(new Request('http://localhost/api/admin/integration/runs'))

    const findArgs = prismaMock.syncRun.findMany.mock.calls[0][0]
    expect(findArgs.select.errorSummary).toBeUndefined()
    expect(findArgs.select.totalRows).toBe(true)
    expect(findArgs.select.status).toBe(true)
  })
})
