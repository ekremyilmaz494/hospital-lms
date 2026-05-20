import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/notifications — "Gönderdiklerim" listesi batch gruplaması.
 *
 * Tek admin gönderimi DB'de N alıcı satırı yaratır (createMany). Bu route o
 * satırları `batchId` üzerinden tek karta indirger. Bu test grup mantığını
 * koruma altına alır:
 *   - Aynı batchId'li satırlar tek batch'e iner; recipientCount/readCount doğru
 *   - Legacy (batchId NULL) satırlar id fallback'iyle tek-row batch olur
 *   - createdAt batch içindeki en erken zaman
 *   - Batch'ler createdAt'e göre azalan sıralanır
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
  safePagination: (sp: URLSearchParams) => ({
    page: Number(sp.get('page')) || 1,
    limit: Number(sp.get('limit')) || 50,
  }),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, ctx?: { params: Promise<P> }) =>
      handler({
        request,
        params: ctx ? await ctx.params : ({} as P),
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
  },
}))

import { GET } from '../route'

function getRequest(params?: Record<string, string>): Request {
  const url = new URL('http://localhost/api/admin/notifications')
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

describe('GET /api/admin/notifications — batch grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('groups rows sharing a batchId into a single batch with correct counts', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'r1', batchId: 'batch-a', title: 'Duyuru', message: 'msg', type: 'info', isRead: true, createdAt: new Date('2026-05-19T10:00:01Z'), relatedTrainingId: null },
      { id: 'r2', batchId: 'batch-a', title: 'Duyuru', message: 'msg', type: 'info', isRead: false, createdAt: new Date('2026-05-19T10:00:00Z'), relatedTrainingId: null },
      { id: 'r3', batchId: 'batch-a', title: 'Duyuru', message: 'msg', type: 'info', isRead: true, createdAt: new Date('2026-05-19T10:00:02Z'), relatedTrainingId: null },
    ])

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.notifications).toHaveLength(1)
    expect(data.total).toBe(1)

    const batch = data.notifications[0]
    expect(batch.batchId).toBe('batch-a')
    expect(batch.isLegacy).toBe(false)
    expect(batch.recipientCount).toBe(3)
    expect(batch.readCount).toBe(2)
    // createdAt = batch içindeki en erken zaman
    expect(batch.createdAt).toBe('2026-05-19T10:00:00.000Z')
  })

  it('treats legacy (batchId NULL) rows as individual single-row batches', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'leg-1', batchId: null, title: 'Eski 1', message: 'm', type: 'warning', isRead: false, createdAt: new Date('2026-05-18T09:00:00Z'), relatedTrainingId: null },
      { id: 'leg-2', batchId: null, title: 'Eski 2', message: 'm', type: 'success', isRead: true, createdAt: new Date('2026-05-17T09:00:00Z'), relatedTrainingId: null },
    ])

    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.notifications).toHaveLength(2)
    for (const b of data.notifications) {
      expect(b.isLegacy).toBe(true)
      expect(b.recipientCount).toBe(1)
    }
    // id, legacy satırlarda batchId yerine grup anahtarı olur
    expect(data.notifications.map((b: { batchId: string }) => b.batchId).sort())
      .toEqual(['leg-1', 'leg-2'])
  })

  it('sorts batches by createdAt descending', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'r1', batchId: 'old', title: 'A', message: 'm', type: 'info', isRead: false, createdAt: new Date('2026-05-01T00:00:00Z'), relatedTrainingId: null },
      { id: 'r2', batchId: 'new', title: 'B', message: 'm', type: 'info', isRead: false, createdAt: new Date('2026-05-19T00:00:00Z'), relatedTrainingId: null },
    ])

    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.notifications[0].batchId).toBe('new')
    expect(data.notifications[1].batchId).toBe('old')
  })

  it('paginates batches (not raw rows)', async () => {
    // 3 batch, her biri 2 satır = 6 row; limit=2 → ilk sayfada 2 batch
    const rows = []
    for (let b = 0; b < 3; b++) {
      for (let r = 0; r < 2; r++) {
        rows.push({
          id: `r-${b}-${r}`, batchId: `batch-${b}`, title: `T${b}`, message: 'm', type: 'info',
          isRead: false, createdAt: new Date(`2026-05-${10 + b}T00:00:00Z`), relatedTrainingId: null,
        })
      }
    }
    prismaMock.notification.findMany.mockResolvedValue(rows)

    const res = await GET(getRequest({ page: '1', limit: '2' }))
    const data = await res.json()

    expect(data.total).toBe(3)
    expect(data.notifications).toHaveLength(2)
  })

  it('scopes the query to the requesting admin and organization', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])

    await GET(getRequest())

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', senderId: 'admin-1' },
      }),
    )
  })
})
