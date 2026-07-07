import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

/**
 * POST /api/integration/v1/files — dosya adaptörü route testleri.
 *
 * Kilitlenen davranışlar:
 * - Geçersiz uzantı → 400; 10MB üstü → 413; sahte .xlsx (magic-byte) → 400.
 * - ?mode=preview → runSync `dryRun: true` ile çağrılır.
 * - CSV happy path (`;` ayırıcılı Türkçe Excel formatı): HEADER_ALIASES çözümü
 *   + normalize → runSync'e doğru StaffRecord ve seçenekler gider.
 * - xlsx happy path: gerçek ExcelJS dosyası parse edilir.
 * - Org bazlı saatlik dosya limiti (integration:file:<org>, 6/3600) → 429.
 * - Org file-config: fieldMapping/defaults/syncMode/deactivate* runSync'e yansır.
 * - Normalize + sync hata satırları yanıttaki `errors`'ta dosya satırıyla döner.
 *
 * Mock deseni route-handler.test.ts kurulumundan alınmıştır.
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
    department: { findMany: vi.fn() },
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
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
// staff-row validateRows yolu kullanılmıyor ama modül tc-crypto'yu import ediyor —
// ENCRYPTION_KEY gerektirmesin.
vi.mock('@/lib/tc-crypto', () => ({
  hashTcKimlik: (tc: string) => `hash:${tc}`,
  encryptTcKimlik: (tc: string) => `enc:${tc}`,
}))
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
    jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
    errorResponse: (message: string, status = 400) =>
      Response.json({ error: message }, { status }),
    createAuditLog: createAuditLogMock,
    checkWritePermission: checkWritePermissionMock,
  }
})

import { POST } from '../route'
import type { SyncResult } from '@/lib/integration/types'

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

const SYNC_RESULT: SyncResult = {
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
  rowResults: [],
}

// Geçerli TC (checksum tutar) — normalize zod refine'ından geçer.
const VALID_TC = '10000000146'

// Türkçe Excel deseni: `;` ayırıcı + alias başlıklar.
const CSV_BASIC =
  `Ad;Soyad;E-posta;TC Kimlik No;Departman;Unvan\n` +
  `Ayşe;Yılmaz;ayse@example.com;${VALID_TC};Acil Servis;Hemşire\n`

function makeUploadRequest(
  opts: {
    fileName?: string
    content?: BlobPart
    query?: string
    contentType?: string
    noFile?: boolean
  } = {},
): Request {
  const form = new FormData()
  if (!opts.noFile) {
    form.append(
      'file',
      new File([opts.content ?? CSV_BASIC], opts.fileName ?? 'personel.csv', {
        type: opts.contentType ?? 'text/csv',
      }),
    )
  }
  const headers = new Headers()
  headers.set('authorization', `Bearer ${TOKEN}`)
  headers.set('x-forwarded-for', '10.0.0.1')
  return new Request(`http://localhost/api/integration/v1/files${opts.query ?? ''}`, {
    method: 'POST',
    headers,
    body: form,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.integrationApiKey.findUnique.mockResolvedValue(DB_KEY)
  prismaMock.integrationApiKey.update.mockResolvedValue({})
  prismaMock.organization.findUnique.mockResolvedValue(ACTIVE_ORG)
  prismaMock.staffIntegration.findUnique.mockResolvedValue(null)
  prismaMock.department.findMany.mockResolvedValue([])
  checkRateLimitMock.mockResolvedValue(true)
  checkFeatureMock.mockResolvedValue(true)
  checkWritePermissionMock.mockResolvedValue(null)
  createAuditLogMock.mockResolvedValue(undefined)
  runSyncMock.mockResolvedValue(SYNC_RESULT)
})

describe('files route — dosya doğrulama', () => {
  it('geçersiz uzantı (.txt) → 400, runSync çağrılmaz', async () => {
    const res = await POST(makeUploadRequest({ fileName: 'personel.txt' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Yalnız .xlsx veya .csv dosyaları kabul edilir' })
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('"file" alanı yok → 400', async () => {
    const res = await POST(makeUploadRequest({ noFile: true }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: '"file" alanı zorunludur (multipart/form-data dosya alanı)',
    })
  })

  it('10MB üstü dosya → 413', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    const res = await POST(makeUploadRequest({ content: big }))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: "Dosya boyutu 10MB'ı aşamaz" })
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('sahte .xlsx (magic-byte PK değil) → 400', async () => {
    const res = await POST(
      makeUploadRequest({ fileName: 'personel.xlsx', content: 'bu bir excel degil' }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Geçersiz dosya içeriği. Sadece gerçek Excel (.xlsx) dosyaları kabul edilir.',
    })
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('2000 satırdan fazla CSV → 400', async () => {
    const lines = ['Ad;Soyad']
    for (let i = 0; i < 2001; i++) lines.push(`Ad${i};Soyad${i}`)
    const res = await POST(makeUploadRequest({ content: lines.join('\n') }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Tek seferde en fazla 2000 satır işlenebilir. Lütfen dosyayı bölerek yükleyin.',
    })
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('geçersiz syncMode parametresi → 400', async () => {
    const res = await POST(makeUploadRequest({ query: '?syncMode=full' }))
    expect(res.status).toBe(400)
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('files route — saatlik dosya limiti', () => {
  it('org limiti dolunca → 429 ve doğru anahtar/limitle kontrol edilir', async () => {
    // 1. çağrı IP, 2. çağrı API anahtarı (wrapper) → geçer; 3. çağrı dosya limiti → dolu.
    checkRateLimitMock.mockImplementation((key: string) =>
      Promise.resolve(!key.startsWith('integration:file:')),
    )
    const res = await POST(makeUploadRequest())
    expect(res.status).toBe(429)
    expect(checkRateLimitMock).toHaveBeenCalledWith('integration:file:org-1', 6, 3600)
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('files route — CSV happy path', () => {
  it('`;` ayırıcılı CSV: alias başlıklar çözülür, runSync doğru kayıt/seçeneklerle çağrılır', async () => {
    const res = await POST(makeUploadRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      runId: 'run-1',
      status: 'completed',
      counts: SYNC_RESULT.counts,
      errors: [],
    })

    expect(runSyncMock).toHaveBeenCalledTimes(1)
    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records).toEqual([
      {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        email: 'ayse@example.com',
        tcKimlik: VALID_TC,
        departmentName: 'Acil Servis',
        title: 'Hemşire',
      },
    ])
    expect(opts).toEqual({
      organizationId: 'org-1',
      channel: 'file',
      trigger: 'file',
      syncMode: 'delta',
      dryRun: false,
      deactivateMissing: undefined,
      deactivateThresholdPct: undefined,
      integrationId: null,
      apiKeyId: 'key-1',
      fileName: 'personel.csv',
    })
  })

  it('audit izi düşer: integration.file.ingest + runId, PII yok', async () => {
    await POST(makeUploadRequest())
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        organizationId: 'org-1',
        action: 'integration.file.ingest',
        entityType: 'sync_run',
        entityId: 'run-1',
        newData: expect.objectContaining({
          fileName: 'personel.csv',
          syncMode: 'delta',
          dryRun: false,
          counts: SYNC_RESULT.counts,
          _integration: { apiKeyId: 'key-1', keyPrefix: 'klx_live_xxxxxx' },
        }),
      }),
    )
    const newData = createAuditLogMock.mock.calls[0][0].newData as Record<string, unknown>
    expect(JSON.stringify(newData)).not.toContain(VALID_TC)
  })

  it('?mode=preview → runSync dryRun: true ile çağrılır', async () => {
    const res = await POST(makeUploadRequest({ query: '?mode=preview' }))
    expect(res.status).toBe(200)
    expect(runSyncMock).toHaveBeenCalledTimes(1)
    expect(runSyncMock.mock.calls[0][1]).toMatchObject({ dryRun: true })
  })

  it('?syncMode=snapshot config yokken bile override eder', async () => {
    await POST(makeUploadRequest({ query: '?syncMode=snapshot' }))
    expect(runSyncMock.mock.calls[0][1]).toMatchObject({ syncMode: 'snapshot' })
  })
})

describe('files route — org file-config', () => {
  it('fieldMapping/defaults/syncMode/deactivate* config uygulanır', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue({
      id: 'int-1',
      isActive: true,
      syncMode: 'snapshot',
      fieldMapping: { 'sicil no': 'externalId' },
      defaults: { departmentName: 'Genel' },
      deactivateMissing: true,
      deactivateThresholdPct: 30,
    })
    const csv =
      `Sicil No;Ad;Soyad;TC Kimlik No;Unvan\n` +
      `EMP-7;Ali;Kaya;${VALID_TC};Tekniker\n`
    const res = await POST(makeUploadRequest({ content: csv }))
    expect(res.status).toBe(200)

    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records).toEqual([
      {
        externalId: 'EMP-7',
        firstName: 'Ali',
        lastName: 'Kaya',
        tcKimlik: VALID_TC,
        departmentName: 'Genel', // defaults boş alanı doldurdu
        title: 'Tekniker',
      },
    ])
    expect(opts).toMatchObject({
      syncMode: 'snapshot',
      integrationId: 'int-1',
      deactivateMissing: true,
      deactivateThresholdPct: 30,
    })
  })

  it('config isActive=false → 403, runSync çağrılmaz', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue({
      id: 'int-1',
      isActive: false,
      syncMode: 'delta',
      fieldMapping: null,
      defaults: null,
      deactivateMissing: false,
      deactivateThresholdPct: 20,
    })
    const res = await POST(makeUploadRequest())
    expect(res.status).toBe(403)
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('files route — hata satırları', () => {
  it('normalize hatası dosya satır numarasıyla errors listesine düşer', async () => {
    const csv =
      `Ad;Soyad;E-posta;TC Kimlik No\n` +
      `Ayşe;Yılmaz;ayse@example.com;${VALID_TC}\n` +
      `Ali;Kaya;ali@example.com;12345678901\n` // geçersiz TC (checksum tutmaz)
    const res = await POST(makeUploadRequest({ content: csv }))
    expect(res.status).toBe(200)

    // Geçersiz satır runSync'e GİTMEZ.
    const [records] = runSyncMock.mock.calls[0]
    expect(records).toHaveLength(1)

    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0]).toMatchObject({ row: 3, stage: 'validation' })
    expect(body.errors[0].message).toContain('TC')
  })

  it('runSync satır hataları dosya satırına geri eşlenip errors listesine eklenir', async () => {
    runSyncMock.mockResolvedValue({
      ...SYNC_RESULT,
      status: 'completed_with_errors',
      counts: { ...SYNC_RESULT.counts, createdRows: 0, failedRows: 1 },
      rowResults: [
        {
          rowIndex: 0,
          action: 'conflict',
          externalId: null,
          userId: null,
          message: 'Bu TC/e-posta başka bir kurumda kayıtlı — manuel çözüm gerekir',
        },
      ],
    })
    const res = await POST(makeUploadRequest())
    const body = await res.json()
    expect(body.status).toBe('completed_with_errors')
    expect(body.errors).toEqual([
      {
        row: 2,
        stage: 'sync',
        message: 'Bu TC/e-posta başka bir kurumda kayıtlı — manuel çözüm gerekir',
      },
    ])
  })

  it('tüm satırlar geçersizse → 400 ve hatalar details içinde', async () => {
    const csv = `Ad;Soyad;TC Kimlik No\n;Kaya;${VALID_TC}\n` // Ad boş → zorunlu alan hatası
    const res = await POST(makeUploadRequest({ content: csv }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Dosyada işlenebilir personel satırı bulunamadı')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('runSync kilit hatası (409) istemciye aynen döner', async () => {
    const { ApiError } = await import('@/lib/api-helpers')
    runSyncMock.mockRejectedValue(
      new ApiError('Bu kurum için devam eden bir senkron var. Lütfen mevcut koşunun bitmesini bekleyin.', 409),
    )
    const res = await POST(makeUploadRequest())
    expect(res.status).toBe(409)
  })
})

describe('files route — xlsx happy path', () => {
  it('gerçek .xlsx dosyası parse edilir ve runSync doğru kayıtla çağrılır', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Personel')
    sheet.addRow(['Ad', 'Soyad', 'E-posta', 'TC Kimlik No', 'Departman', 'Unvan'])
    sheet.addRow(['Ali', 'Veli', 'ali@example.com', VALID_TC, 'Acil', 'Hemşire'])
    const buffer = await workbook.xlsx.writeBuffer()

    const res = await POST(
      makeUploadRequest({
        fileName: 'personel.xlsx',
        content: new Uint8Array(buffer as ArrayBuffer),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    expect(res.status).toBe(200)

    expect(runSyncMock).toHaveBeenCalledTimes(1)
    const [records, opts] = runSyncMock.mock.calls[0]
    expect(records).toEqual([
      {
        firstName: 'Ali',
        lastName: 'Veli',
        email: 'ali@example.com',
        tcKimlik: VALID_TC,
        // Org'da departman yok (department.findMany → []) → ham ad geçer,
        // ingest fuzzy/auto-create yapar.
        departmentName: 'Acil',
        title: 'Hemşire',
      },
    ])
    expect(opts).toMatchObject({ channel: 'file', fileName: 'personel.xlsx' })
  })
})
