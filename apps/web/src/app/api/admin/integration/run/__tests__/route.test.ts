import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/admin/integration/run — "Şimdi Çalıştır" (manuel pull tetiği).
 *
 * Kritik güvenceler:
 *  - Feature gate kapalıysa 403; saatlik limit (6/saat) 429.
 *  - Pull config yok / pullBaseUrl boş → 404; kanal pasif → 409.
 *  - dryRun/force runPullForIntegration'a opts olarak taşınır (force YALNIZ bu uçtan).
 *  - Fetch/senkron hatası kullanıcı hatası değildir → 200 + { ok:false, message }.
 */

const { prismaMock, checkFeatureMock, checkRateLimitMock, runPullMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    staffIntegration: { findUnique: vi.fn() },
  },
  checkFeatureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  runPullMock: vi.fn(),
  auditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }))
vi.mock('@/lib/integration/pull', () => ({ runPullForIntegration: (...a: unknown[]) => runPullMock(...a) }))
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

import { POST } from '../route'

function pullIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    organizationId: 'org-1',
    channel: 'pull',
    isActive: true,
    syncMode: 'delta',
    deactivateMissing: false,
    deactivateThresholdPct: 20,
    fieldMapping: null,
    defaults: null,
    pullBaseUrl: 'https://ik.hastane.example/api/personel',
    pullAuthType: 'bearer',
    pullCredentialsEncrypted: 'aa:bb:cc',
    pullPagination: null,
    ...overrides,
  }
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/integration/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  checkRateLimitMock.mockResolvedValue(true)
  prismaMock.staffIntegration.findUnique.mockResolvedValue(pullIntegration())
  runPullMock.mockResolvedValue({
    ok: true,
    runId: 'run-1',
    status: 'completed',
    counts: { totalRows: 5, createdRows: 2, updatedRows: 1, deactivatedRows: 0, reactivatedRows: 0, skippedRows: 2, failedRows: 0 },
  })
})

describe('POST /api/admin/integration/run', () => {
  it('feature gate kapalıysa 403', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const res = await POST(postRequest({ channel: 'pull' }))
    expect(res.status).toBe(403)
    expect(runPullMock).not.toHaveBeenCalled()
  })

  it('saatlik limit aşımında 429 (integration:run:<org>, 6/saat)', async () => {
    checkRateLimitMock.mockResolvedValue(false)
    const res = await POST(postRequest({ channel: 'pull' }))
    expect(res.status).toBe(429)
    expect(checkRateLimitMock).toHaveBeenCalledWith('integration:run:org-1', 6, 3600)
  })

  it('geçersiz gövde (channel != pull) → 400', async () => {
    const res = await POST(postRequest({ channel: 'push' }))
    expect(res.status).toBe(400)
  })

  it('pull config yoksa 404', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(null)
    const res = await POST(postRequest({ channel: 'pull' }))
    expect(res.status).toBe(404)
  })

  it('config var ama pullBaseUrl boşsa 404', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(pullIntegration({ pullBaseUrl: null }))
    const res = await POST(postRequest({ channel: 'pull' }))
    expect(res.status).toBe(404)
  })

  it('kanal pasifse 409', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(pullIntegration({ isActive: false }))
    const res = await POST(postRequest({ channel: 'pull' }))
    expect(res.status).toBe(409)
  })

  it('happy path: dryRun/force opts olarak taşınır, yanıt runId+status+counts, audit yazılır', async () => {
    const res = await POST(postRequest({ channel: 'pull', dryRun: true, force: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, runId: 'run-1', status: 'completed' })
    expect(body.counts.totalRows).toBe(5)

    const [integration, trigger, requestedById, opts] = runPullMock.mock.calls[0]
    expect((integration as { id: string }).id).toBe('int-1')
    expect(trigger).toBe('manual')
    expect(requestedById).toBe('admin-1')
    expect(opts).toEqual({ dryRun: true, force: true })

    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'integration.run.manual',
      entityType: 'sync_run',
      entityId: 'run-1',
    }))
  })

  it('varsayılanlar: dryRun/force verilmezse false geçer', async () => {
    await POST(postRequest({ channel: 'pull' }))
    const opts = runPullMock.mock.calls[0][3]
    expect(opts).toEqual({ dryRun: false, force: false })
  })

  it('senkron hatası (ok:false) → 200 + { ok:false, message } (test-connection emsali)', async () => {
    runPullMock.mockResolvedValue({ ok: false, error: 'İK API\'sine bağlanılamadı.' })
    const res = await POST(postRequest({ channel: 'pull' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.message).toContain('bağlanılamadı')
  })
})
