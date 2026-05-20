import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/admin/notifications/batch/[batchId] — batch alıcı detayı + silme.
 *
 *  - GET: alıcı listesi + okunma özeti döner; legacy (batchId NULL) satır için
 *    parametre tek bir notification.id olarak da eşleşir
 *  - DELETE: gönderimin tüm satırlarını siler; senderId guard ile başka admin'in
 *    batch'i silinemez
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
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

import { GET, DELETE } from '../route'

const batchUrl = 'http://localhost/api/admin/notifications/batch/batch-a'

function withParams(batchId: string) {
  return { params: Promise.resolve({ batchId }) }
}

describe('GET /api/admin/notifications/batch/[batchId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns recipient list with read summary', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'r1', isRead: true, createdAt: new Date('2026-05-19T10:00:00Z'), title: 'Duyuru', message: 'm', type: 'info', user: { id: 'u1', firstName: 'Ali', lastName: 'Veli', email: 'ali@x.com', title: 'Hemşire', departmentRel: { id: 'd1', name: 'Acil' } } },
      { id: 'r2', isRead: false, createdAt: new Date('2026-05-19T10:00:00Z'), title: 'Duyuru', message: 'm', type: 'info', user: { id: 'u2', firstName: 'Ayşe', lastName: 'Kaya', email: 'ayse@x.com', title: null, departmentRel: null } },
    ])

    const res = await GET(new Request(batchUrl), withParams('batch-a'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.recipientCount).toBe(2)
    expect(data.readCount).toBe(1)
    expect(data.recipients).toHaveLength(2)
    expect(data.recipients[0].departmentName).toBe('Acil')
    expect(data.recipients[1].departmentName).toBeNull()
  })

  it('returns 404 when no rows match the batch', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])

    const res = await GET(new Request(batchUrl), withParams('missing'))
    expect(res.status).toBe(404)
  })

  it('matches both real batchId and legacy id fallback, scoped to admin + org', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'leg-1', isRead: false, createdAt: new Date(), title: 'T', message: 'm', type: 'info', user: { id: 'u1', firstName: 'A', lastName: 'B', email: 'a@x.com', title: null, departmentRel: null } },
    ])

    await GET(new Request(batchUrl), withParams('leg-1'))

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          senderId: 'admin-1',
          OR: [{ batchId: 'leg-1' }, { id: 'leg-1', batchId: null }],
        }),
      }),
    )
  })
})

describe('DELETE /api/admin/notifications/batch/[batchId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes all rows of the batch and reports the count', async () => {
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 5 })

    const res = await DELETE(new Request(batchUrl, { method: 'DELETE' }), withParams('batch-a'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.deleted).toBe(5)
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        senderId: 'admin-1',
        OR: [{ batchId: 'batch-a' }, { id: 'batch-a', batchId: null }],
      },
    })
  })

  it('returns 404 when the batch deletes nothing (not owned / not found)', async () => {
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 })

    const res = await DELETE(new Request(batchUrl, { method: 'DELETE' }), withParams('other-admin-batch'))
    expect(res.status).toBe(404)
  })
})
