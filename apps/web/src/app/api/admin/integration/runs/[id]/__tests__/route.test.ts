import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/integration/runs/[id] — koşu detayı + satır sonuçları.
 *
 * Kritik güvenceler:
 *  - Feature gate kapalıysa 403.
 *  - Başka org'un koşusu → 404 (run VE satır sorguları org-scoped).
 *  - ?action=error filtresi satır sorgularına uygulanır; geçersiz filtre 400.
 */

const { prismaMock, checkFeatureMock } = vi.hoisted(() => ({
  prismaMock: {
    syncRun: { findFirst: vi.fn() },
    syncRowResult: { count: vi.fn(), findMany: vi.fn() },
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
    async (request: Request, routeCtx?: { params: Promise<Record<string, string>> }) =>
      handler({
        request,
        params: routeCtx?.params ? await routeCtx.params : {},
        dbUser: { id: 'admin-1' },
        organizationId: 'org-1',
        audit: () => Promise.resolve(),
      }),
}))

import { GET } from '../route'

// RFC-4122 uyumlu v4 UUID — zod v4 z.string().uuid() version/variant bitlerini doğrular
const RUN_ID = '9b2b6f4e-6f0a-4a8d-8f3e-2b1c9d4e5f6a'

function callGet(id: string, query = '') {
  return GET(
    new Request(`http://localhost/api/admin/integration/runs/${id}${query}`),
    { params: Promise.resolve({ id }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  prismaMock.syncRun.findFirst.mockResolvedValue({
    id: RUN_ID,
    integrationId: 'int-1',
    channel: 'push',
    trigger: 'api',
    mode: 'apply',
    syncMode: 'delta',
    status: 'completed_with_errors',
    totalRows: 3,
    createdRows: 1,
    updatedRows: 1,
    deactivatedRows: 0,
    reactivatedRows: 0,
    skippedRows: 0,
    failedRows: 1,
    errorSummary: null,
    fileName: null,
    startedAt: new Date('2026-07-02T21:00:00Z'),
    completedAt: new Date('2026-07-02T21:00:10Z'),
  })
  prismaMock.syncRowResult.count.mockResolvedValue(1)
  prismaMock.syncRowResult.findMany.mockResolvedValue([
    {
      id: 'row-1', rowIndex: 2, externalId: 'EXT-9', action: 'error',
      userId: null, message: 'E-posta biçimi geçersiz', payloadMasked: { email: 'a***@***' },
      createdAt: new Date('2026-07-02T21:00:05Z'),
    },
  ])
})

describe('GET /api/admin/integration/runs/[id]', () => {
  it('feature kapalı → 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await callGet(RUN_ID)
    expect(res.status).toBe(403)
    expect(prismaMock.syncRun.findFirst).not.toHaveBeenCalled()
  })

  it('BAŞKA org\'un koşusu → 404 (run sorgusu org-scoped)', async () => {
    prismaMock.syncRun.findFirst.mockResolvedValue(null)

    const res = await callGet(RUN_ID)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Senkron koşusu bulunamadı')
    expect(prismaMock.syncRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RUN_ID, organizationId: 'org-1' },
      }),
    )
  })

  it('geçersiz UUID → 404, prisma\'ya hiç gidilmez', async () => {
    const res = await callGet('bozuk-id')
    expect(res.status).toBe(404)
    expect(prismaMock.syncRun.findFirst).not.toHaveBeenCalled()
  })

  it('satır sorguları da org-scoped (defense-in-depth) + Cache-Control set', async () => {
    const res = await callGet(RUN_ID)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.run.id).toBe(RUN_ID)
    expect(data.rows).toHaveLength(1)
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })

    const rowWhere = { syncRunId: RUN_ID, organizationId: 'org-1' }
    expect(prismaMock.syncRowResult.count).toHaveBeenCalledWith({ where: rowWhere })
    expect(prismaMock.syncRowResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: rowWhere, orderBy: { rowIndex: 'asc' } }),
    )
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })

  it('?action=error filtresi count + findMany satır sorgularına uygulanır', async () => {
    await callGet(RUN_ID, '?action=error')

    const expectedWhere = { syncRunId: RUN_ID, organizationId: 'org-1', action: 'error' }
    expect(prismaMock.syncRowResult.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(prismaMock.syncRowResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    )
  })

  it('geçersiz action filtresi → 400', async () => {
    const res = await callGet(RUN_ID, '?action=explode')
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Geçersiz işlem filtresi')
    expect(prismaMock.syncRowResult.findMany).not.toHaveBeenCalled()
  })

  it('sayfalama satır sonuçlarına uygulanır (limit 100 sınırı)', async () => {
    await callGet(RUN_ID, '?page=2&limit=500')

    const findArgs = prismaMock.syncRowResult.findMany.mock.calls[0][0]
    expect(findArgs.take).toBe(100)
    expect(findArgs.skip).toBe(100)
  })
})
