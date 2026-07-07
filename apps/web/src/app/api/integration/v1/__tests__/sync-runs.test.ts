import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/integration/v1/sync-runs/[id] — koşu durumu sorgulama (M2M push).
 *
 * withIntegrationRoute GERÇEK; prisma/redis/feature-gate/license mock.
 *
 * Kilitlenen davranışlar:
 * - Org-scope ZORUNLU: koşu başka org'a aitse (findFirst null) → 404.
 * - Geçersiz UUID Prisma'ya inmeden 404 (cast hatası/iç detay sızmaz).
 * - action filtresi satır sorgusuna yansır; geçersiz action → 400.
 * - Sayfalama: varsayılan limit 100, üst sınır 500.
 * - Cache-Control: private, max-age=10, stale-while-revalidate=30.
 */

const {
  prismaMock,
  checkRateLimitMock,
  checkFeatureMock,
  checkWritePermissionMock,
  createAuditLogMock,
} = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: { findUnique: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    syncRun: { findFirst: vi.fn() },
    syncRowResult: { count: vi.fn(), findMany: vi.fn() },
  },
  checkRateLimitMock: vi.fn(),
  checkFeatureMock: vi.fn(),
  checkWritePermissionMock: vi.fn(),
  createAuditLogMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: checkRateLimitMock,
  getRedis: vi.fn(() => null),
}))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: checkFeatureMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api-helpers', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: Record<string, unknown>,
    ) {
      super(message)
      this.name = 'ApiError'
    }
    toResponse(): Response {
      const body: Record<string, unknown> = { error: this.message }
      if (this.details) body.details = this.details
      return Response.json(body, { status: this.status })
    }
  }
  return {
    ApiError,
    jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
      Response.json(data, { status, headers }),
    errorResponse: (message: string, status = 400) =>
      Response.json({ error: message }, { status }),
    parseBody: async (req: Request) => req.json().catch(() => null),
    createAuditLog: createAuditLogMock,
    checkWritePermission: checkWritePermissionMock,
  }
})

import { GET } from '../sync-runs/[id]/route'

const TOKEN = `klx_live_${'x'.repeat(40)}`
const RUN_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const DB_KEY = {
  id: 'key-1',
  organizationId: 'org-1',
  keyPrefix: 'klx_live_xxxxxx',
  revokedAt: null,
  expiresAt: null,
  lastUsedAt: new Date(),
}

const ACTIVE_ORG = {
  isActive: true,
  isSuspended: false,
  ipAllowlistEnabled: false,
  ipAllowlist: [],
}

const RUN_ROW = {
  id: RUN_ID,
  integrationId: null,
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
  startedAt: new Date('2026-07-03T10:00:00Z'),
  completedAt: new Date('2026-07-03T10:00:05Z'),
}

const ROW_RESULT = {
  id: 'row-1',
  rowIndex: 2,
  externalId: 'E3',
  action: 'error',
  userId: null,
  message: 'Eşleme anahtarı yok (sicil no / TC / e-posta) — satır işlenemedi',
  payloadMasked: { externalId: 'E3' },
  createdAt: new Date('2026-07-03T10:00:05Z'),
}

function makeRequest(id: string, query = '') {
  const request = new Request(`http://localhost/api/integration/v1/sync-runs/${id}${query}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-forwarded-for': '10.0.0.1',
    },
  })
  return { request, ctx: { params: Promise.resolve({ id }) } }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.integrationApiKey.findUnique.mockResolvedValue(DB_KEY)
  prismaMock.integrationApiKey.update.mockResolvedValue({})
  prismaMock.organization.findUnique.mockResolvedValue(ACTIVE_ORG)
  prismaMock.syncRun.findFirst.mockResolvedValue(RUN_ROW)
  prismaMock.syncRowResult.count.mockResolvedValue(1)
  prismaMock.syncRowResult.findMany.mockResolvedValue([ROW_RESULT])
  checkRateLimitMock.mockResolvedValue(true)
  checkFeatureMock.mockResolvedValue(true)
  checkWritePermissionMock.mockResolvedValue(null)
  createAuditLogMock.mockResolvedValue(undefined)
})

describe('GET /api/integration/v1/sync-runs/[id] — org-scope + id doğrulama', () => {
  it('koşu bulunur → 200 { run, rows, pagination } + zorunlu Cache-Control', async () => {
    const { request, ctx } = makeRequest(RUN_ID)

    const res = await GET(request, ctx)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=10, stale-while-revalidate=30')
    expect(data.run).toEqual(expect.objectContaining({ id: RUN_ID, status: 'completed_with_errors' }))
    expect(data.rows).toHaveLength(1)
    expect(data.pagination).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 })

    // Başlık VE satır sorguları org-scoped (defense-in-depth)
    expect(prismaMock.syncRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RUN_ID, organizationId: 'org-1' },
    }))
    expect(prismaMock.syncRowResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { syncRunId: RUN_ID, organizationId: 'org-1' },
      skip: 0,
      take: 100,
    }))
  })

  it('başka org\'un koşusu (findFirst null) → 404', async () => {
    prismaMock.syncRun.findFirst.mockResolvedValue(null)
    const { request, ctx } = makeRequest(RUN_ID)

    const res = await GET(request, ctx)

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Senkron koşusu bulunamadı')
  })

  it('geçersiz UUID → 404, Prisma\'ya hiç inilmez', async () => {
    const { request, ctx } = makeRequest('gecersiz-id')

    const res = await GET(request, ctx)

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Senkron koşusu bulunamadı')
    expect(prismaMock.syncRun.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.syncRowResult.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/integration/v1/sync-runs/[id] — action filtresi + sayfalama', () => {
  it('?action=error satır sorgusuna yansır', async () => {
    const { request, ctx } = makeRequest(RUN_ID, '?action=error')

    const res = await GET(request, ctx)

    expect(res.status).toBe(200)
    expect(prismaMock.syncRowResult.count).toHaveBeenCalledWith({
      where: { syncRunId: RUN_ID, organizationId: 'org-1', action: 'error' },
    })
    expect(prismaMock.syncRowResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { syncRunId: RUN_ID, organizationId: 'org-1', action: 'error' },
    }))
  })

  it('geçersiz action → 400 Geçersiz işlem filtresi', async () => {
    const { request, ctx } = makeRequest(RUN_ID, '?action=bilinmeyen')

    const res = await GET(request, ctx)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Geçersiz işlem filtresi')
    expect(prismaMock.syncRowResult.findMany).not.toHaveBeenCalled()
  })

  it('limit 500 üstüne kırpılır; page/limit skip\'e doğru yansır', async () => {
    const { request, ctx } = makeRequest(RUN_ID, '?page=3&limit=9999')

    const res = await GET(request, ctx)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination.limit).toBe(500)
    expect(prismaMock.syncRowResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 1000, // (3-1) * 500
      take: 500,
    }))
  })

  it('bozuk sayfalama parametreleri varsayılana döner (page=1, limit=100)', async () => {
    const { request, ctx } = makeRequest(RUN_ID, '?page=abc&limit=xyz')

    const res = await GET(request, ctx)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination).toEqual(expect.objectContaining({ page: 1, limit: 100 }))
  })
})
