import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/admin/integration — kanal config GET/PUT.
 *
 * Kritik güvenceler:
 *  - Feature gate (staffIntegration) kapalıysa 403 — GET dahil.
 *  - GET yanıtında pullCredentialsEncrypted ASLA sızmaz → pullCredentialsSet maskesi.
 *  - PUT'ta pullCredentials verilirse encrypt()'ten geçer; verilmezse mevcut korunur.
 *  - Write rate limit (30/saat) aşılırsa 429.
 */

const { prismaMock, checkFeatureMock, checkRateLimitMock, encryptMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    staffIntegration: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
  checkFeatureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  encryptMock: vi.fn(),
  auditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }))
vi.mock('@/lib/crypto', () => ({ encrypt: (...a: unknown[]) => encryptMock(...a) }))
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

import { GET, PUT } from '../route'

const SECRET_ENCRYPTED = '0011aabb:ffee:c1c1c1-gizli-sifreli-deger'

function integrationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    channel: 'pull',
    isActive: true,
    syncMode: 'delta',
    fieldMapping: null,
    defaults: null,
    deactivateMissing: false,
    deactivateThresholdPct: 20,
    pullBaseUrl: 'https://hbys.example.com/api',
    pullAuthType: 'bearer',
    pullCredentialsEncrypted: SECRET_ENCRYPTED,
    pullIntervalMinutes: 60,
    pullPagination: null,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  }
}

function putRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/integration', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  checkRateLimitMock.mockResolvedValue(true)
  encryptMock.mockImplementation((s: string) => `enc(${s})`)
  prismaMock.staffIntegration.findMany.mockResolvedValue([integrationRow()])
  prismaMock.staffIntegration.findUnique.mockResolvedValue(null)
  prismaMock.staffIntegration.upsert.mockResolvedValue(integrationRow())
})

describe('GET /api/admin/integration — feature gate + credential maskesi', () => {
  it('feature kapalı → 403, DB\'ye gidilmez', async () => {
    checkFeatureMock.mockResolvedValue(false)

    const res = await GET(new Request('http://localhost/api/admin/integration'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe('Personel entegrasyonu planınızda etkin değil.')
    expect(prismaMock.staffIntegration.findMany).not.toHaveBeenCalled()
  })

  it('config listesi org-scoped döner, şifreli credential SIZMAZ → pullCredentialsSet maskesi', async () => {
    const res = await GET(new Request('http://localhost/api/admin/integration'))
    const raw = await res.text()
    const data = JSON.parse(raw)

    expect(res.status).toBe(200)
    expect(prismaMock.staffIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    )
    expect(data.integrations).toHaveLength(1)
    expect(data.integrations[0].pullCredentialsSet).toBe(true)
    // Ham şifreli değer VE alan adı yanıtta hiç görünmemeli
    expect(raw).not.toContain(SECRET_ENCRYPTED)
    expect(raw).not.toContain('pullCredentialsEncrypted')
  })

  it('credential set edilmemiş kanal → pullCredentialsSet:false + Cache-Control başlığı', async () => {
    prismaMock.staffIntegration.findMany.mockResolvedValue([
      integrationRow({ channel: 'push', pullCredentialsEncrypted: null }),
    ])

    const res = await GET(new Request('http://localhost/api/admin/integration'))
    const data = await res.json()

    expect(data.integrations[0].pullCredentialsSet).toBe(false)
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })
})

describe('PUT /api/admin/integration — config upsert', () => {
  it('feature kapalı → 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await PUT(putRequest({ channel: 'push' }))
    expect(res.status).toBe(403)
  })

  it('rate limit aşıldı → 429, upsert çağrılmaz', async () => {
    checkRateLimitMock.mockResolvedValue(false)
    const res = await PUT(putRequest({ channel: 'push' }))
    expect(res.status).toBe(429)
    expect(prismaMock.staffIntegration.upsert).not.toHaveBeenCalled()
  })

  it('pullCredentials verilirse encrypt() ile şifrelenip saklanır, yanıtta düz değer SIZMAZ', async () => {
    const res = await PUT(putRequest({
      channel: 'pull',
      pullAuthType: 'bearer',
      pullCredentials: { token: 'cok-gizli-token-123' },
    }))
    const raw = await res.text()

    expect(res.status).toBe(201) // yeni kayıt (findUnique null)
    expect(encryptMock).toHaveBeenCalledWith(JSON.stringify({ token: 'cok-gizli-token-123' }))

    const upsertArgs = prismaMock.staffIntegration.upsert.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({
      organizationId_channel: { organizationId: 'org-1', channel: 'pull' },
    })
    expect(upsertArgs.create.pullCredentialsEncrypted).toBe(
      `enc(${JSON.stringify({ token: 'cok-gizli-token-123' })})`,
    )
    expect(upsertArgs.update.pullCredentialsEncrypted).toBe(
      `enc(${JSON.stringify({ token: 'cok-gizli-token-123' })})`,
    )
    // Düz credential ne yanıtta ne audit'te görünür
    expect(raw).not.toContain('cok-gizli-token-123')
    expect(JSON.stringify(auditMock.mock.calls)).not.toContain('cok-gizli-token-123')
  })

  it('pullCredentials verilmezse mevcut şifreli değer KORUNUR (update\'te alan yok)', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(integrationRow())

    const res = await PUT(putRequest({ channel: 'pull', pullIntervalMinutes: 30 }))

    expect(res.status).toBe(200) // mevcut kayıt güncellendi
    const upsertArgs = prismaMock.staffIntegration.upsert.mock.calls[0][0]
    expect(Object.keys(upsertArgs.update)).not.toContain('pullCredentialsEncrypted')
    expect(encryptMock).not.toHaveBeenCalled()
  })

  it('audit oldData/newData credential içermez, action integration.config.update', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(integrationRow())

    await PUT(putRequest({ channel: 'pull', isActive: false }))

    expect(auditMock).toHaveBeenCalledTimes(1)
    const auditPayload = auditMock.mock.calls[0][0] as { action: string }
    expect(auditPayload.action).toBe('integration.config.update')
    const serialized = JSON.stringify(auditPayload)
    expect(serialized).not.toContain(SECRET_ENCRYPTED)
    expect(serialized).not.toContain('pullCredentialsEncrypted')
  })

  it('geçersiz gövde → 400 (eşik 5 altında, http:// pull adresi, bilinmeyen kanal)', async () => {
    const tooLow = await PUT(putRequest({ channel: 'file', deactivateThresholdPct: 3 }))
    expect(tooLow.status).toBe(400)

    const httpUrl = await PUT(putRequest({ channel: 'pull', pullBaseUrl: 'http://insecure.example.com' }))
    expect(httpUrl.status).toBe(400)

    const badChannel = await PUT(putRequest({ channel: 'ftp' }))
    expect(badChannel.status).toBe(400)

    expect(prismaMock.staffIntegration.upsert).not.toHaveBeenCalled()
  })

  it('pullIntervalMinutes 15-1440 aralığı dışı → 400', async () => {
    const tooFast = await PUT(putRequest({ channel: 'pull', pullIntervalMinutes: 5 }))
    expect(tooFast.status).toBe(400)

    const tooSlow = await PUT(putRequest({ channel: 'pull', pullIntervalMinutes: 2000 }))
    expect(tooSlow.status).toBe(400)
  })
})
