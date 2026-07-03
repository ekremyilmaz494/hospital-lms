import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POST /api/integration/v1/sync — toplu personel senkronu (M2M push).
 *
 * withIntegrationRoute + idempotency GERÇEK (getRedis null → in-memory);
 * prisma/redis/feature-gate/license mock, runSync mock, normalize gerçek.
 *
 * Kilitlenen davranışlar:
 * - dry-run ve apply koşuları doğru SyncOptions ile runSync'e iner;
 *   `force` API'den ASLA geçilmez.
 * - snapshot'ta deactivateMissing/threshold org config'inden okunur;
 *   config yoksa deactivateMissing false.
 * - 2000 üstü kayıt → 400; boş dizi → 400.
 * - Org-bazlı saatlik limit (10/3600) → 429 Türkçe mesaj.
 * - Idempotency-Key replay: runSync İKİNCİ KEZ ÇALIŞMAZ, ilk yanıt döner.
 * - Normalize satır hataları + runSync error/conflict satırları HAM dizi
 *   index'iyle `errors`'ta raporlanır (kayan index geri eşlenir).
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

import { POST } from '../sync/route'

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

const VALID_ROW_1 = { externalId: 'E1', firstName: 'Ali', lastName: 'Yılmaz' }
const VALID_ROW_2 = { externalId: 'E2', firstName: 'Ayşe', lastName: 'Kaya' }

function syncResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    status: 'completed',
    counts: {
      totalRows: 2,
      createdRows: 2,
      updatedRows: 0,
      deactivatedRows: 0,
      reactivatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    },
    rowResults: [
      { rowIndex: 0, action: 'create', externalId: 'E1', userId: 'u1', message: null },
      { rowIndex: 1, action: 'create', externalId: 'E2', userId: 'u2', message: null },
    ],
    ...overrides,
  }
}

function makeRequest(body: unknown, opts: { idempotencyKey?: string } = {}): Request {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN}`,
    'x-forwarded-for': '10.0.0.1',
    'content-type': 'application/json',
  })
  if (opts.idempotencyKey) headers.set('idempotency-key', opts.idempotencyKey)
  return new Request('http://localhost/api/integration/v1/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

describe('POST /api/integration/v1/sync — koşu seçenekleri', () => {
  it('dry-run delta → runSync dryRun:true ile çağrılır; yanıt { runId, status, counts, errors }', async () => {
    const res = await POST(makeRequest({ mode: 'delta', dryRun: true, records: [VALID_ROW_1, VALID_ROW_2] }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      runId: 'run-1',
      status: 'completed',
      counts: expect.objectContaining({ totalRows: 2, createdRows: 2 }),
      errors: [],
    })

    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records).toHaveLength(2)
    expect(opts).toEqual(expect.objectContaining({
      organizationId: 'org-1',
      channel: 'push',
      trigger: 'api',
      syncMode: 'delta',
      dryRun: true,
      integrationId: null,
      apiKeyId: 'key-1',
    }))
    // delta'da snapshot güvenlik anahtarları hiç geçilmez
    expect('deactivateMissing' in opts).toBe(false)
  })

  it("apply snapshot → deactivateMissing/threshold config'ten; force API'den ASLA geçilmez", async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue({
      id: 'int-1',
      isActive: true,
      fieldMapping: null,
      defaults: null,
      deactivateMissing: true,
      deactivateThresholdPct: 30,
    })

    const res = await POST(makeRequest({ mode: 'snapshot', records: [VALID_ROW_1, VALID_ROW_2] }))

    expect(res.status).toBe(200)
    const [, opts] = runSyncMock.mock.calls[0]
    expect(opts).toEqual(expect.objectContaining({
      syncMode: 'snapshot',
      dryRun: false, // dryRun default'u
      deactivateMissing: true,
      deactivateThresholdPct: 30,
      integrationId: 'int-1',
    }))
    expect('force' in opts).toBe(false)
  })

  it('config yokken snapshot → deactivateMissing false (feed tam liste olsa da kimse pasifleşmez)', async () => {
    await POST(makeRequest({ mode: 'snapshot', records: [VALID_ROW_1] }))

    const [, opts] = runSyncMock.mock.calls[0]
    expect(opts.deactivateMissing).toBe(false)
    expect('deactivateThresholdPct' in opts).toBe(false)
  })

  it('güvenlik eşiği aşımında runSync aborted döner → istemci 200 ile status aborted görür', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      status: 'aborted',
      counts: {
        totalRows: 2, createdRows: 0, updatedRows: 0, deactivatedRows: 0,
        reactivatedRows: 0, skippedRows: 0, failedRows: 0,
      },
      rowResults: [],
    }))

    const res = await POST(makeRequest({ mode: 'snapshot', records: [VALID_ROW_1, VALID_ROW_2] }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('aborted')
  })
})

describe('POST /api/integration/v1/sync — validasyon + limitler', () => {
  it('2001 kayıt → 400, runSync çağrılmaz', async () => {
    const records = Array.from({ length: 2001 }, (_, i) => ({
      externalId: `E${i}`, firstName: 'A', lastName: 'B',
    }))

    const res = await POST(makeRequest({ mode: 'delta', records }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('2000')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('boş records → 400; geçersiz mode → 400', async () => {
    const empty = await POST(makeRequest({ mode: 'delta', records: [] }))
    expect(empty.status).toBe(400)

    const badMode = await POST(makeRequest({ mode: 'full', records: [VALID_ROW_1] }))
    expect(badMode.status).toBe(400)
    expect((await badMode.json()).error).toContain('snapshot')

    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('saatlik toplu senkron limiti → 429 Türkçe mesaj, runSync çağrılmaz', async () => {
    checkRateLimitMock.mockImplementation(async (key: string) => !key.startsWith('integration:sync:'))

    const res = await POST(makeRequest({ mode: 'delta', records: [VALID_ROW_1] }))

    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe('Saatlik toplu senkron limiti aşıldı.')
    expect(checkRateLimitMock).toHaveBeenCalledWith('integration:sync:org-1', 10, 3600)
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('hiçbir kayıt doğrulanamazsa → 422, koşu hiç başlamaz (boş snapshot kazası koruması)', async () => {
    const res = await POST(makeRequest({
      mode: 'snapshot',
      records: [{ externalId: 'E1' }, { externalId: 'E2' }], // ad/soyad yok
    }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error).toBe('Gönderilen kayıtların hiçbiri doğrulanamadı')
    expect(data.details.errors).toHaveLength(2)
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/integration/v1/sync — errors raporu', () => {
  it('normalize hataları + error/conflict satırları HAM dizi index\'iyle raporlanır', async () => {
    // raw[0] geçerli, raw[1] normalize hatası, raw[2] geçerli ama runSync'te conflict.
    // runSync yalnız 2 geçerli kaydı görür → conflict recordIndex 1 = ham index 2.
    runSyncMock.mockResolvedValue(syncResult({
      status: 'completed_with_errors',
      counts: {
        totalRows: 2, createdRows: 1, updatedRows: 0, deactivatedRows: 0,
        reactivatedRows: 0, skippedRows: 0, failedRows: 1,
      },
      rowResults: [
        { rowIndex: 0, action: 'create', externalId: 'E1', userId: 'u1', message: null },
        { rowIndex: 1, action: 'conflict', externalId: 'E3', userId: null, message: 'Bu TC/e-posta başka bir kurumda kayıtlı — manuel çözüm gerekir' },
      ],
    }))

    const res = await POST(makeRequest({
      mode: 'delta',
      records: [
        VALID_ROW_1,
        { externalId: 'E2' }, // ad/soyad yok → normalize hatası
        { externalId: 'E3', firstName: 'Can', lastName: 'Demir' },
      ],
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.errors).toEqual([
      expect.objectContaining({ rowIndex: 1, action: 'error', message: expect.stringContaining('zorunludur') }),
      expect.objectContaining({ rowIndex: 2, action: 'conflict', externalId: 'E3' }),
    ])
  })
})

describe('POST /api/integration/v1/sync — idempotency', () => {
  it('aynı Idempotency-Key ikinci istekte runSync\'i ÇALIŞTIRMAZ, ilk yanıtı replay eder', async () => {
    const body = { mode: 'delta', records: [VALID_ROW_1] }

    const first = await POST(makeRequest(body, { idempotencyKey: 'sync-replay-1' }))
    expect(first.status).toBe(200)
    expect(runSyncMock).toHaveBeenCalledTimes(1)

    const second = await POST(makeRequest(body, { idempotencyKey: 'sync-replay-1' }))
    expect(runSyncMock).toHaveBeenCalledTimes(1) // yeniden ÇALIŞMADI
    expect(second.status).toBe(200)
    expect(second.headers.get('Idempotency-Replayed')).toBe('true')
    expect(await second.json()).toEqual(await first.clone().json())
  })
})
