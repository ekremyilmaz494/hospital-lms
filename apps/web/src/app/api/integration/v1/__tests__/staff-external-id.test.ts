import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/integration/v1/staff/[externalId] — PATCH (kısmi güncelleme) + DELETE (deaktivasyon).
 *
 * withIntegrationRoute GERÇEK; prisma/redis/feature-gate/license mock, runSync mock.
 *
 * Kilitlenen davranışlar:
 * - Kullanıcı composite unique (org+externalId) ile bulunur; yoksa 404.
 * - PATCH: body + mevcut değerlerden TAM StaffRecord kurulur (gönderilmeyen alan
 *   "silindi" sayılmaz); pasif kullanıcıya alan PATCH'i onu AKTİFLEŞTİRMEZ
 *   (active mevcut durumdan taşınır).
 * - PATCH departman önceliği: body.departmentId > body.departmentName > mevcut.
 * - DELETE: active:false satırı runSync'ten geçer → action 'deactivate' 200;
 *   zaten pasifse runSync 'skip' üretir → 200.
 * - error|conflict → 422 (yönetici hesabı entegrasyonla silinemez).
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
    user: { findUnique: vi.fn() },
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

import { PATCH, DELETE } from '../staff/[externalId]/route'

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

const EXISTING_USER = {
  id: 'user-1',
  firstName: 'Ali',
  lastName: 'Yılmaz',
  email: 'ali@example.com',
  phone: null,
  title: null,
  departmentId: null,
  hireDate: null,
  isActive: true,
}

function syncResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    status: 'completed',
    counts: {
      totalRows: 1,
      createdRows: 0,
      updatedRows: 1,
      deactivatedRows: 0,
      reactivatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    },
    rowResults: [
      { rowIndex: 0, action: 'update', externalId: 'EMP-1', userId: 'user-1', message: null },
    ],
    ...overrides,
  }
}

function makeRequest(method: 'PATCH' | 'DELETE', externalId: string, body?: unknown) {
  const request = new Request(`http://localhost/api/integration/v1/staff/${encodeURIComponent(externalId)}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-forwarded-for': '10.0.0.1',
      'content-type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return { request, ctx: { params: Promise.resolve({ externalId }) } }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.integrationApiKey.findUnique.mockResolvedValue(DB_KEY)
  prismaMock.integrationApiKey.update.mockResolvedValue({})
  prismaMock.organization.findUnique.mockResolvedValue(ACTIVE_ORG)
  prismaMock.staffIntegration.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(EXISTING_USER)
  checkRateLimitMock.mockResolvedValue(true)
  checkFeatureMock.mockResolvedValue(true)
  checkWritePermissionMock.mockResolvedValue(null)
  createAuditLogMock.mockResolvedValue(undefined)
  runSyncMock.mockResolvedValue(syncResult())
})

describe('PATCH /api/integration/v1/staff/[externalId]', () => {
  it('kullanıcı yok → 404 Personel bulunamadı, runSync çağrılmaz', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const { request, ctx } = makeRequest('PATCH', 'EMP-404', { title: 'Hemşire' })

    const res = await PATCH(request, ctx)

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Personel bulunamadı')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('composite unique ile arar; body + mevcut değerlerden TAM kayıt kurup delta işler → 200', async () => {
    const { request, ctx } = makeRequest('PATCH', 'EMP-1', { title: 'Hemşire' })

    const res = await PATCH(request, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ runId: 'run-1', action: 'update', userId: 'user-1' })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_org_external_unique: { organizationId: 'org-1', externalId: 'EMP-1' } },
    }))
    const [records, opts] = runSyncMock.mock.calls[0]
    // Gönderilmeyen alanlar mevcut değerlerden taşınır — delta diff "silindi" sanmaz.
    expect(records[0]).toEqual({
      externalId: 'EMP-1',
      firstName: 'Ali',
      lastName: 'Yılmaz',
      email: 'ali@example.com',
      title: 'Hemşire',
      active: true,
    })
    expect(opts).toEqual(expect.objectContaining({
      syncMode: 'delta',
      channel: 'push',
      trigger: 'api',
      dryRun: false,
      apiKeyId: 'key-1',
    }))
  })

  it('pasif kullanıcıya alan PATCH\'i onu aktifleştirmez (active mevcut durumdan false taşınır)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...EXISTING_USER, isActive: false })
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{ rowIndex: 0, action: 'skip', externalId: 'EMP-1', userId: 'user-1', message: 'Zaten pasif' }],
    }))
    const { request, ctx } = makeRequest('PATCH', 'EMP-1', { phone: '05551112233' })

    const res = await PATCH(request, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      runId: 'run-1', action: 'skip', userId: 'user-1', message: 'Zaten pasif',
    })
    const [records] = runSyncMock.mock.calls[0]
    expect(records[0].active).toBe(false)
  })

  it('departman önceliği: body.departmentName mevcut departmentId\'yi ezer', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...EXISTING_USER, departmentId: 'dept-old' })
    const { request, ctx } = makeRequest('PATCH', 'EMP-1', { departmentName: 'Acil Servis' })

    await PATCH(request, ctx)

    const [records] = runSyncMock.mock.calls[0]
    expect(records[0].departmentName).toBe('Acil Servis')
    expect(records[0].departmentId).toBeUndefined()
  })

  it('geçersiz e-posta → 422 normalize mesajı, runSync çağrılmaz', async () => {
    const { request, ctx } = makeRequest('PATCH', 'EMP-1', { email: 'gecersiz-eposta' })

    const res = await PATCH(request, ctx)

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Geçersiz e-posta')
    expect(runSyncMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/integration/v1/staff/[externalId]', () => {
  it('aktif personel → active:false satırı runSync\'ten geçer → 200 action deactivate', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{ rowIndex: 0, action: 'deactivate', externalId: 'EMP-1', userId: 'user-1', message: 'Pasifleştirildi' }],
    }))
    const { request, ctx } = makeRequest('DELETE', 'EMP-1')

    const res = await DELETE(request, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      runId: 'run-1', action: 'deactivate', userId: 'user-1', message: 'Pasifleştirildi',
    })
    const [records] = runSyncMock.mock.calls[0]
    expect(records).toEqual([
      { externalId: 'EMP-1', firstName: 'Ali', lastName: 'Yılmaz', active: false },
    ])
  })

  it('zaten pasif → runSync skip üretir → 200 action skip', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...EXISTING_USER, isActive: false })
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{ rowIndex: 0, action: 'skip', externalId: 'EMP-1', userId: 'user-1', message: 'Zaten pasif' }],
    }))
    const { request, ctx } = makeRequest('DELETE', 'EMP-1')

    const res = await DELETE(request, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      runId: 'run-1', action: 'skip', userId: 'user-1', message: 'Zaten pasif',
    })
  })

  it('kullanıcı yok → 404, runSync çağrılmaz', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const { request, ctx } = makeRequest('DELETE', 'EMP-404')

    const res = await DELETE(request, ctx)

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Personel bulunamadı')
    expect(runSyncMock).not.toHaveBeenCalled()
  })

  it('yönetici hesabı (conflict) → 422', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{
        rowIndex: 0,
        action: 'conflict',
        externalId: 'EMP-1',
        userId: null,
        message: 'Yönetici hesapları entegrasyonla güncellenemez',
      }],
    }))
    const { request, ctx } = makeRequest('DELETE', 'EMP-1')

    const res = await DELETE(request, ctx)

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Yönetici hesapları')
  })

  it('audit: integration.staff.deactivate entityId externalId ile düşer', async () => {
    runSyncMock.mockResolvedValue(syncResult({
      rowResults: [{ rowIndex: 0, action: 'deactivate', externalId: 'EMP-1', userId: 'user-1', message: null }],
    }))
    const { request, ctx } = makeRequest('DELETE', 'EMP-1')

    await DELETE(request, ctx)

    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      action: 'integration.staff.deactivate',
      entityType: 'user',
      entityId: 'EMP-1',
    }))
  })
})
