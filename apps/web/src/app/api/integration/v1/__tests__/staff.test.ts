import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POST /api/integration/v1/staff — tekil personel upsert (M2M push).
 *
 * withIntegrationRoute GERÇEK çalışır (route-handler.test deseni) — altındaki
 * prisma/redis/feature-gate/license mock'lanır; normalize + zod şemaları gerçek,
 * runSync (ingest) mock'lanır.
 *
 * Kilitlenen davranışlar:
 * - create → 201, update → 200; yanıt `{ runId, action, userId?, message? }`.
 * - error|conflict satırı → 422 + Türkçe mesaj (details.runId ile).
 * - normalize satır hatası (eksik ad, bozuk TC) → 422; runSync HİÇ çağrılmaz.
 * - externalId eksik → 400 (upsert anahtarı zorunlu).
 * - Push config varsa fieldMapping/defaults uygulanır + integrationId geçilir;
 *   yoksa kimliksel eşleme + integrationId null.
 * - Config isActive=false → 403 (kanal bilinçli kapalı).
 * - runSync kilit 409'u (ApiError) istemciye aynen döner.
 */

const {
  prismaMock,
  checkRateLimitMock,
  checkFeatureMock,
  checkWritePermissionMock,
  createAuditLogMock,
  runSyncMock,
} = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: { findUnique: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    staffIntegration: { findUnique: vi.fn() },
  },
  checkRateLimitMock: vi.fn(),
  checkFeatureMock: vi.fn(),
  checkWritePermissionMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  runSyncMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: checkRateLimitMock,
  getRedis: vi.fn(() => null),
}))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: checkFeatureMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/integration/ingest', () => ({ runSync: runSyncMock }))
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

import { POST } from '../staff/route'

const TOKEN = `klx_live_${'x'.repeat(40)}`

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

function pushConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    isActive: true,
    fieldMapping: null,
    defaults: null,
    deactivateMissing: false,
    deactivateThresholdPct: 20,
    ...overrides,
  }
}

function syncResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    status: 'completed',
    counts: {
      totalRows: 1,
      createdRows: 1,
      updatedRows: 0,
      deactivatedRows: 0,
      reactivatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    },
    rowResults: [
      { rowIndex: 0, action: 'create', externalId: 'EMP-1', userId: 'user-1', message: null },
    ],
    ...overrides,
  }
}

function makeRequest(body?: unknown, rawBody?: string): Request {
  return new Request('http://localhost/api/integration/v1/staff', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-forwarded-for': '10.0.0.1',
      'content-type': 'application/json',
    },
    body: rawBody ?? JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.integrationApiKey.findUnique.mockResolvedValue(DB_KEY)
  prismaMock.integrationApiKey.update.mockResolvedValue({})
  prismaMock.organization.findUnique.mockResolvedValue(ACTIVE_ORG)
  prismaMock.staffIntegration.findUnique.mockResolvedValue(null)
  checkRateLimitMock.mockResolvedValue(true)
  checkFeatureMock.mockResolvedValue(true)
  checkWritePermissionMock.mockResolvedValue(null)
  createAuditLogMock.mockResolvedValue(undefined)
  runSyncMock.mockResolvedValue(syncResult())
})

describe('POST /api/integration/v1/staff — upsert sonucu', () => {
  it('create → 201, yanıt { runId, action, userId }; runSync delta/push/api ile çağrılır', async () => {
    const res = await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ runId: 'run-1', action: 'create', userId: 'user-1' })

    expect(runSyncMock).toHaveBeenCalledTimes(1)
    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records).toEqual([{ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }])
    expect(opts).toEqual({
      organizationId: 'org-1',
      channel: 'push',
      trigger: 'api',
      syncMode: 'delta',
      dryRun: false,
      integrationId: null,
      apiKeyId: 'key-1',
    })
  })

  it('update → 200; sayısal externalId string\'e coerce edilir (HBYS feed toleransı)', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{ rowIndex: 0, action: 'update', externalId: '12345', userId: 'user-2', message: null }],
    }))

    const res = await POST(makeRequest({ externalId: 12345, firstName: 'Ayşe', lastName: 'Kaya' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ runId: 'run-1', action: 'update', userId: 'user-2' })
    const [records] = runSyncMock.mock.calls[0]
    expect(records[0].externalId).toBe('12345')
  })

  it('conflict satırı → 422 Türkçe mesaj + details.runId', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{
        rowIndex: 0,
        action: 'conflict',
        externalId: 'EMP-1',
        userId: null,
        message: 'Yönetici hesapları entegrasyonla güncellenemez',
      }],
    }))

    const res = await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error).toBe('Yönetici hesapları entegrasyonla güncellenemez')
    expect(data.details).toEqual({ runId: 'run-1', action: 'conflict' })
  })

  it('error satırı → 422 satır mesajıyla', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{
        rowIndex: 0,
        action: 'error',
        externalId: 'EMP-1',
        userId: null,
        message: 'Personel limiti doldu — bu satır oluşturulamadı. Planınızı yükseltin.',
      }],
    }))

    const res = await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Personel limiti doldu')
  })
})

describe('POST /api/integration/v1/staff — validasyon', () => {
  it('externalId eksik → 400, runSync çağrılmaz', async () => {
    const res = await POST(makeRequest({ firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Sicil no (externalId) zorunludur')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('ad eksik → normalize satır hatasıyla 422, runSync çağrılmaz', async () => {
    const res = await POST(makeRequest({ externalId: 'EMP-1', lastName: 'Yılmaz' }))

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Ad zorunludur')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('geçersiz TC checksum → 422 Türkçe mesaj', async () => {
    const res = await POST(makeRequest({
      externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz', tcKimlik: '12345678901',
    }))

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Geçersiz TC Kimlik No')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('bozuk JSON gövde → 400 Geçersiz veri', async () => {
    const res = await POST(makeRequest(undefined, 'bu-json-degil{'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Geçersiz veri')
  })
})

describe('POST /api/integration/v1/staff — push config', () => {
  it('config varsa fieldMapping/defaults uygulanır ve integrationId geçilir', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(pushConfigRow({
      fieldMapping: { adi: 'firstName', soyadi: 'lastName' },
      defaults: { departmentName: 'Genel' },
    }))

    const res = await POST(makeRequest({ externalId: 'EMP-9', adi: 'Ayşe', soyadi: 'Kaya' }))

    expect(res.status).toBe(201)
    expect(prismaMock.staffIntegration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_channel: { organizationId: 'org-1', channel: 'push' } },
      }),
    )
    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records[0]).toEqual({
      externalId: 'EMP-9',
      firstName: 'Ayşe',
      lastName: 'Kaya',
      departmentName: 'Genel',
    })
    expect(opts.integrationId).toBe('int-1')
  })

  it('config isActive=false → 403 kanal kapalı, runSync çağrılmaz', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(pushConfigRow({ isActive: false }))

    const res = await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('devre dışı')
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/integration/v1/staff — kilit + audit', () => {
  it('runSync kilit 409 fırlatırsa istemciye aynen döner', async () => {
    const { ApiError } = await import('@/lib/api-helpers')
    runSyncMock.mockRejectedValue(new ApiError(
      'Bu kurum için devam eden bir senkron var. Lütfen mevcut koşunun bitmesini bekleyin.', 409,
    ))

    const res = await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('devam eden bir senkron var')
  })

  it('audit: integration.staff.upsert + entityId externalId + makine izi (_integration)', async () => {
    await POST(makeRequest({ externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz' }))

    expect(createAuditLogMock).toHaveBeenCalledTimes(1)
    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      organizationId: 'org-1',
      action: 'integration.staff.upsert',
      entityType: 'user',
      entityId: 'EMP-1',
      newData: expect.objectContaining({
        runId: 'run-1',
        rowAction: 'create',
        userId: 'user-1',
        _integration: { apiKeyId: 'key-1', keyPrefix: 'klx_live_xxxxxx' },
      }),
    }))
  })
})
