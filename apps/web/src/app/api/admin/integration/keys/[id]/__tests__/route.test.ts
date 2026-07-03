import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * DELETE /api/admin/integration/keys/[id] — anahtar iptali (revoke).
 *
 * Kritik güvenceler:
 *  - Org-scope: başka org'un anahtarı → 404 (cross-tenant koruması).
 *  - Revoke = soft (revokedAt), hard delete DEĞİL.
 *  - Zaten revoke'lu anahtar → 409.
 */

const { prismaMock, checkFeatureMock, checkRateLimitMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
  checkFeatureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  auditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
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
        audit: (p: unknown) => { auditMock(p); return Promise.resolve() },
      }),
}))

import { DELETE } from '../route'

// RFC-4122 uyumlu v4 UUID — zod v4 z.string().uuid() version/variant bitlerini doğrular
const KEY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function callDelete(id: string) {
  return DELETE(
    new Request(`http://localhost/api/admin/integration/keys/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  checkRateLimitMock.mockResolvedValue(true)
  prismaMock.integrationApiKey.findFirst.mockResolvedValue({
    id: KEY_ID, name: 'HBYS Push', keyPrefix: 'klx_live_abc123', revokedAt: null,
  })
  prismaMock.integrationApiKey.updateMany.mockResolvedValue({ count: 1 })
})

describe('DELETE /api/admin/integration/keys/[id]', () => {
  it('feature kapalı → 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await callDelete(KEY_ID)
    expect(res.status).toBe(403)
    expect(prismaMock.integrationApiKey.findFirst).not.toHaveBeenCalled()
  })

  it('rate limit aşıldı → 429', async () => {
    checkRateLimitMock.mockResolvedValue(false)
    const res = await callDelete(KEY_ID)
    expect(res.status).toBe(429)
  })

  it('BAŞKA org\'un anahtarı → 404 (sorgu org-scoped, cross-tenant koruması)', async () => {
    // Org filtresi nedeniyle findFirst null döner — id var ama org-2'ye ait
    prismaMock.integrationApiKey.findFirst.mockResolvedValue(null)

    const res = await callDelete(KEY_ID)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Anahtar bulunamadı')
    expect(prismaMock.integrationApiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: KEY_ID, organizationId: 'org-1' },
      }),
    )
    expect(prismaMock.integrationApiKey.updateMany).not.toHaveBeenCalled()
  })

  it('geçersiz UUID → 404, prisma\'ya hiç gidilmez', async () => {
    const res = await callDelete('gecersiz-id')
    expect(res.status).toBe(404)
    expect(prismaMock.integrationApiKey.findFirst).not.toHaveBeenCalled()
  })

  it('zaten revoke edilmiş anahtar → 409', async () => {
    prismaMock.integrationApiKey.findFirst.mockResolvedValue({
      id: KEY_ID, name: 'Eski', keyPrefix: 'klx_live_abc123', revokedAt: new Date('2026-06-01T00:00:00Z'),
    })

    const res = await callDelete(KEY_ID)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe('Anahtar zaten iptal edilmiş')
    expect(prismaMock.integrationApiKey.updateMany).not.toHaveBeenCalled()
  })

  it('başarılı revoke → soft (updateMany revokedAt), org-scoped, audit düşer', async () => {
    const res = await callDelete(KEY_ID)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe(KEY_ID)
    expect(data.revokedAt).toBeTruthy()

    const updateArgs = prismaMock.integrationApiKey.updateMany.mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: KEY_ID, organizationId: 'org-1', revokedAt: null })
    expect(updateArgs.data.revokedAt).toBeInstanceOf(Date)

    expect(auditMock).toHaveBeenCalledTimes(1)
    const payload = auditMock.mock.calls[0][0] as { action: string; entityId: string }
    expect(payload.action).toBe('integration.key.revoke')
    expect(payload.entityId).toBe(KEY_ID)
  })

  it('eşzamanlı yarışta updateMany 0 satır etkilerse → 409', async () => {
    prismaMock.integrationApiKey.updateMany.mockResolvedValue({ count: 0 })
    const res = await callDelete(KEY_ID)
    expect(res.status).toBe(409)
    expect(auditMock).not.toHaveBeenCalled()
  })
})
