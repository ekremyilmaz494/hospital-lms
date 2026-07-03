import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/admin/integration/keys — API anahtarı listesi + üretimi.
 *
 * Kritik güvenceler:
 *  - Feature gate kapalıysa 403.
 *  - POST: plaintext YALNIZ yanıtta; DB'ye yalnız hash+prefix yazılır;
 *    audit'e plaintext/hash ASLA girmez.
 *  - Aktif (revoke edilmemiş) anahtar sayısı ≥10 → 409.
 *  - GET listesinde keyHash asla dönmez.
 */

const { prismaMock, checkFeatureMock, checkRateLimitMock, generateApiKeyMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  checkFeatureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  generateApiKeyMock: vi.fn(),
  auditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }))
vi.mock('@/lib/integration/api-key', () => ({ generateApiKey: (...a: unknown[]) => generateApiKeyMock(...a) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
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
        audit: (p: unknown) => { auditMock(p); return Promise.resolve() },
      }),
}))

import { GET, POST } from '../route'

const PLAINTEXT = 'klx_live_SUPERGIZLIDUZANAHTAR1234567890abcdXYZ'
const HASH = 'a'.repeat(64)
const PREFIX = 'klx_live_SUPERG'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/integration/keys', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  checkRateLimitMock.mockResolvedValue(true)
  generateApiKeyMock.mockReturnValue({ plaintext: PLAINTEXT, prefix: PREFIX, hash: HASH })
  prismaMock.integrationApiKey.count.mockResolvedValue(0)
  prismaMock.integrationApiKey.findMany.mockResolvedValue([])
  prismaMock.integrationApiKey.create.mockResolvedValue({
    id: 'key-1',
    name: 'HBYS Push',
    keyPrefix: PREFIX,
    expiresAt: null,
    createdAt: new Date('2026-07-03T00:00:00Z'),
  })
})

describe('GET /api/admin/integration/keys', () => {
  it('feature kapalı → 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await GET(new Request('http://localhost/api/admin/integration/keys'))
    expect(res.status).toBe(403)
    expect(prismaMock.integrationApiKey.findMany).not.toHaveBeenCalled()
  })

  it('liste org-scoped, keyHash SELECT edilmez ve yanıtta görünmez', async () => {
    prismaMock.integrationApiKey.findMany.mockResolvedValue([
      {
        id: 'key-1', name: 'HBYS Push', keyPrefix: PREFIX,
        lastUsedAt: null, expiresAt: null, revokedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
    ])

    const res = await GET(new Request('http://localhost/api/admin/integration/keys'))
    const raw = await res.text()

    expect(res.status).toBe(200)
    const findArgs = prismaMock.integrationApiKey.findMany.mock.calls[0][0]
    expect(findArgs.where).toEqual({ organizationId: 'org-1' })
    expect(findArgs.select.keyHash).toBeUndefined()
    expect(raw).not.toContain('keyHash')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })
})

describe('POST /api/admin/integration/keys', () => {
  it('feature kapalı → 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await POST(postRequest({ name: 'HBYS Push' }))
    expect(res.status).toBe(403)
    expect(prismaMock.integrationApiKey.create).not.toHaveBeenCalled()
  })

  it('rate limit aşıldı → 429', async () => {
    checkRateLimitMock.mockResolvedValue(false)
    const res = await POST(postRequest({ name: 'HBYS Push' }))
    expect(res.status).toBe(429)
    expect(prismaMock.integrationApiKey.create).not.toHaveBeenCalled()
  })

  it('plaintext YALNIZ yanıtta döner; DB\'ye hash+prefix yazılır, plaintext ASLA', async () => {
    const res = await POST(postRequest({ name: 'HBYS Push' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.plaintext).toBe(PLAINTEXT)
    expect(data.keyPrefix).toBe(PREFIX)

    const createArgs = prismaMock.integrationApiKey.create.mock.calls[0][0]
    expect(createArgs.data.keyHash).toBe(HASH)
    expect(createArgs.data.keyPrefix).toBe(PREFIX)
    expect(createArgs.data.organizationId).toBe('org-1')
    expect(createArgs.data.createdById).toBe('admin-1')
    // Düz anahtar prisma çağrısının HİÇBİR yerinde geçmez
    expect(JSON.stringify(createArgs)).not.toContain(PLAINTEXT)
  })

  it('audit newData\'da plaintext ve hash ASLA yer almaz, yalnız keyPrefix', async () => {
    await POST(postRequest({ name: 'HBYS Push' }))

    expect(auditMock).toHaveBeenCalledTimes(1)
    const payload = auditMock.mock.calls[0][0] as { action: string; newData: Record<string, unknown> }
    expect(payload.action).toBe('integration.key.create')
    expect(payload.newData.keyPrefix).toBe(PREFIX)
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain(PLAINTEXT)
    expect(serialized).not.toContain(HASH)
  })

  it('10 aktif anahtar varken → 409, yeni anahtar üretilmez', async () => {
    prismaMock.integrationApiKey.count.mockResolvedValue(10)

    const res = await POST(postRequest({ name: 'Taşan Anahtar' }))
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toContain('10 aktif anahtar')
    expect(prismaMock.integrationApiKey.create).not.toHaveBeenCalled()
    // Sayım revoke edilmemişlerle sınırlı olmalı
    expect(prismaMock.integrationApiKey.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', revokedAt: null },
    })
  })

  it('geçmiş expiresAt → 400', async () => {
    const res = await POST(postRequest({ name: 'Eski', expiresAt: '2020-01-01T00:00:00Z' }))
    expect(res.status).toBe(400)
    expect(prismaMock.integrationApiKey.create).not.toHaveBeenCalled()
  })

  it('isim boş veya 100 karakterden uzun → 400', async () => {
    const empty = await POST(postRequest({ name: '   ' }))
    expect(empty.status).toBe(400)

    const long = await POST(postRequest({ name: 'x'.repeat(101) }))
    expect(long.status).toBe(400)
  })
})
