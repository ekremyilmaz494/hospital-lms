import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * withIntegrationRoute — M2M entegrasyon route HOF'unun akış testleri.
 *
 * Kilitlenen davranışlar:
 * - Authorization eksik ve geçersiz anahtar AYNI jenerik 401 gövdesini alır
 *   (neden sızdırma yok).
 * - Feature kapalı / suspended org / lisans kilidi → 403.
 * - Rate limit aşımı (IP veya anahtar bazlı) → 429.
 * - Happy path: handler doğru ctx (organizationId, apiKey) ile çağrılır.
 * - Idempotency: aynı Idempotency-Key ikinci istekte handler'ı ÇALIŞTIRMAZ,
 *   ilk yanıtı `Idempotency-Replayed: true` ile döndürür; 2xx-dışı yanıt
 *   saklanmaz (retry yeniden çalıştırır).
 * - ctx.audit makine aktörü izini (`_integration`) newData'ya merge eder.
 */

const {
  prismaMock,
  checkRateLimitMock,
  checkFeatureMock,
  checkWritePermissionMock,
  createAuditLogMock,
  licenseApiGateMock,
} = vi.hoisted(() => ({
  prismaMock: {
    integrationApiKey: { findUnique: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
  checkRateLimitMock: vi.fn(),
  checkFeatureMock: vi.fn(),
  checkWritePermissionMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  licenseApiGateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/license/enforcement', () => ({ licenseApiGate: licenseApiGateMock }))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: checkRateLimitMock,
  // getRedis null → idempotency modülü in-memory fallback kullanır (dev deseni).
  getRedis: vi.fn(() => null),
}))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: checkFeatureMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
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
      return Response.json({ error: this.message }, { status: this.status })
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

import { withIntegrationRoute, type IntegrationContext } from '../route-handler'
import { idempotencyBegin } from '../idempotency'

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

function makeRequest(
  opts: { method?: string; token?: string | null; idempotencyKey?: string; ip?: string } = {},
): Request {
  const headers = new Headers()
  if (opts.token !== null) headers.set('authorization', `Bearer ${opts.token ?? TOKEN}`)
  if (opts.idempotencyKey) headers.set('idempotency-key', opts.idempotencyKey)
  headers.set('x-forwarded-for', opts.ip ?? '10.0.0.1')
  return new Request('http://localhost/api/integration/staff', {
    method: opts.method ?? 'GET',
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.integrationApiKey.findUnique.mockResolvedValue(DB_KEY)
  prismaMock.integrationApiKey.update.mockResolvedValue({})
  prismaMock.organization.findUnique.mockResolvedValue(ACTIVE_ORG)
  checkRateLimitMock.mockResolvedValue(true)
  checkFeatureMock.mockResolvedValue(true)
  checkWritePermissionMock.mockResolvedValue(null)
  createAuditLogMock.mockResolvedValue(undefined)
  licenseApiGateMock.mockResolvedValue({ blocked: false }) // bulut/lisanslı varsayılan
})

describe('withIntegrationRoute — auth', () => {
  it('Authorization header yok → 401 jenerik mesaj, handler çağrılmaz', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest({ token: null }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Kimlik doğrulanamadı' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('geçersiz anahtar → 401 ve eksik-header ile AYNI gövde (bilgi sızdırmama)', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)

    const missingRes = await route(makeRequest({ token: null }))
    prismaMock.integrationApiKey.findUnique.mockResolvedValue(null)
    const invalidRes = await route(makeRequest({ token: `klx_live_${'y'.repeat(40)}` }))

    expect(invalidRes.status).toBe(401)
    expect(missingRes.status).toBe(401)
    expect(await invalidRes.json()).toEqual(await missingRes.json())
    expect(handler).not.toHaveBeenCalled()
  })

  it('revoked anahtar → aynı jenerik 401', async () => {
    prismaMock.integrationApiKey.findUnique.mockResolvedValue({
      ...DB_KEY,
      revokedAt: new Date(),
    })
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Kimlik doğrulanamadı' })
  })
})

describe('withIntegrationRoute — org/plan/lisans kapıları', () => {
  it('suspended org → 403 "Kurum hesabı aktif değil"', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ ...ACTIVE_ORG, isSuspended: true })
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Kurum hesabı aktif değil' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('inaktif veya bulunamayan org → 403', async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({ ...ACTIVE_ORG, isActive: false })
    const route = withIntegrationRoute(vi.fn(async () => Response.json({ ok: true })))
    expect((await route(makeRequest())).status).toBe(403)

    prismaMock.organization.findUnique.mockResolvedValueOnce(null)
    expect((await route(makeRequest())).status).toBe(403)
  })

  it('geçerli anahtar + feature kapalı → 403 plan mesajı', async () => {
    checkFeatureMock.mockResolvedValue(false)
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Personel entegrasyonu planınızda etkin değil. Lütfen Klinovax ile iletişime geçin.',
    })
    expect(checkFeatureMock).toHaveBeenCalledWith('org-1', 'staffIntegration')
    expect(handler).not.toHaveBeenCalled()
  })

  it('on-prem lisans kilidi (licenseApiGate blocked) → 403, handler çağrılmaz', async () => {
    licenseApiGateMock.mockResolvedValue({
      blocked: true,
      code: 'license_locked',
      message: 'Lisans kilitli.',
    })
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Lisans kilitli.' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('IP allowlist açık + eşleşmeyen IP → 403; eşleşen IP → geçer', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      ...ACTIVE_ORG,
      ipAllowlistEnabled: true,
      ipAllowlist: ['10.0.0.0/8'],
    })
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)

    const denied = await route(makeRequest({ ip: '192.168.1.50' }))
    expect(denied.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()

    const allowed = await route(makeRequest({ ip: '10.0.0.7' }))
    expect(allowed.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('write metodunda checkWritePermission Response dönerse aynen döndürülür', async () => {
    checkWritePermissionMock.mockResolvedValue(
      Response.json({ error: 'Aboneliğiniz sona ermiştir.' }, { status: 403 }),
    )
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest({ method: 'POST' }))
    expect(res.status).toBe(403)
    expect(checkWritePermissionMock).toHaveBeenCalledWith('org-1', 'POST')
    expect(handler).not.toHaveBeenCalled()
  })

  it('GET isteğinde write-guard hiç çağrılmaz', async () => {
    const route = withIntegrationRoute(vi.fn(async () => Response.json({ ok: true })))
    await route(makeRequest({ method: 'GET' }))
    expect(checkWritePermissionMock).not.toHaveBeenCalled()
  })
})

describe('withIntegrationRoute — rate limit', () => {
  it('IP limiti aşıldı → 429, auth\'a hiç gidilmez', async () => {
    checkRateLimitMock.mockResolvedValueOnce(false)
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' })
    expect(prismaMock.integrationApiKey.findUnique).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it('anahtar limiti aşıldı → 429 (IP limiti geçse bile)', async () => {
    checkRateLimitMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const route = withIntegrationRoute(vi.fn(async () => Response.json({ ok: true })))
    const res = await route(makeRequest())
    expect(res.status).toBe(429)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(1, 'integration:ip:10.0.0.1', 60, 60)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, 'integration:key:key-1', 120, 60)
  })

  it('options.rateLimitPerMinute anahtar limitine yansır', async () => {
    const route = withIntegrationRoute(vi.fn(async () => Response.json({ ok: true })), {
      rateLimitPerMinute: 30,
    })
    await route(makeRequest())
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, 'integration:key:key-1', 30, 60)
  })
})

describe('withIntegrationRoute — happy path + audit', () => {
  it('handler doğru ctx ile çağrılır ve yanıtı aynen döner', async () => {
    const handler = vi.fn(async (ctx: IntegrationContext) =>
      Response.json({ data: 42, org: ctx.organizationId }, { status: 200 }),
    )
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: 42, org: 'org-1' })
    expect(handler).toHaveBeenCalledTimes(1)

    const ctx = handler.mock.calls[0][0]
    expect(ctx.organizationId).toBe('org-1')
    expect(ctx.apiKey).toEqual({ id: 'key-1', keyPrefix: 'klx_live_xxxxxx' })
    expect(ctx.request).toBeInstanceOf(Request)
  })

  it('ctx.audit — userId:null + _integration izi newData\'ya merge edilir', async () => {
    const handler = vi.fn(async (ctx: IntegrationContext) => {
      await ctx.audit({
        action: 'integration.staff.upsert',
        entityType: 'user',
        entityId: 'user-9',
        newData: { firstName: 'Ali' },
      })
      return Response.json({ ok: true })
    })
    const route = withIntegrationRoute(handler)
    await route(makeRequest())

    expect(createAuditLogMock).toHaveBeenCalledTimes(1)
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        organizationId: 'org-1',
        action: 'integration.staff.upsert',
        entityType: 'user',
        entityId: 'user-9',
        newData: {
          firstName: 'Ali',
          _integration: { apiKeyId: 'key-1', keyPrefix: 'klx_live_xxxxxx' },
        },
      }),
    )
  })
})

describe('withIntegrationRoute — idempotency', () => {
  it('aynı Idempotency-Key ikinci çağrıda handler\'ı ÇALIŞTIRMAZ, ilk yanıtı replay eder', async () => {
    let counter = 0
    const handler = vi.fn(async () => {
      counter += 1
      return Response.json({ created: true, seq: counter }, { status: 201 })
    })
    const route = withIntegrationRoute(handler)

    const first = await route(makeRequest({ method: 'POST', idempotencyKey: 'replay-test-1' }))
    expect(first.status).toBe(201)
    expect(await first.json()).toEqual({ created: true, seq: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    const second = await route(makeRequest({ method: 'POST', idempotencyKey: 'replay-test-1' }))
    expect(handler).toHaveBeenCalledTimes(1) // yeniden ÇALIŞMADI
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotency-Replayed')).toBe('true')
    expect(second.headers.get('Content-Type')).toBe('application/json')
    expect(await second.json()).toEqual({ created: true, seq: 1 })
  })

  it('farklı Idempotency-Key handler\'ı yeniden çalıştırır', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }, { status: 201 }))
    const route = withIntegrationRoute(handler)
    await route(makeRequest({ method: 'POST', idempotencyKey: 'distinct-key-a' }))
    await route(makeRequest({ method: 'POST', idempotencyKey: 'distinct-key-b' }))
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('işlem sürerken (pending) aynı key → 409', async () => {
    // Kilidi elle al — route çağrısı pending görür. scope = route'un pathname'i
    // (`/api/integration/staff`, makeRequest URL'i) ile AYNI olmalı.
    await idempotencyBegin('org-1', 'pending-test-1', '/api/integration/staff')
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest({ method: 'POST', idempotencyKey: 'pending-test-1' }))
    expect(res.status).toBe(409)
    expect(handler).not.toHaveBeenCalled()
  })

  it('2xx-dışı yanıt SAKLANMAZ — retry handler\'ı yeniden çalıştırır', async () => {
    let calls = 0
    const handler = vi.fn(async () => {
      calls += 1
      return calls === 1
        ? Response.json({ error: 'Geçersiz veri' }, { status: 400 })
        : Response.json({ ok: true }, { status: 201 })
    })
    const route = withIntegrationRoute(handler)

    const first = await route(makeRequest({ method: 'POST', idempotencyKey: 'retry-test-1' }))
    expect(first.status).toBe(400)

    const second = await route(makeRequest({ method: 'POST', idempotencyKey: 'retry-test-1' }))
    expect(second.status).toBe(201)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(second.headers.get('Idempotency-Replayed')).toBeNull()
  })

  it('GET isteğinde Idempotency-Key yok sayılır', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    await route(makeRequest({ method: 'GET', idempotencyKey: 'get-ignored-1' }))
    await route(makeRequest({ method: 'GET', idempotencyKey: 'get-ignored-1' }))
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('options.idempotency: false → header yok sayılır', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }, { status: 201 }))
    const route = withIntegrationRoute(handler, { idempotency: false })
    await route(makeRequest({ method: 'POST', idempotencyKey: 'disabled-test-1' }))
    await route(makeRequest({ method: 'POST', idempotencyKey: 'disabled-test-1' }))
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('200 karakterden uzun Idempotency-Key → 400', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const route = withIntegrationRoute(handler)
    const res = await route(makeRequest({ method: 'POST', idempotencyKey: 'k'.repeat(201) }))
    expect(res.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('withIntegrationRoute — hata yakalama', () => {
  it('handler ApiError fırlatırsa kendi status/mesajıyla döner', async () => {
    const { ApiError } = await import('@/lib/api-helpers')
    const route = withIntegrationRoute(vi.fn(async () => {
      throw new ApiError('Geçersiz veri', 400)
    }))
    const res = await route(makeRequest({ method: 'POST' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Geçersiz veri' })
  })

  it('yapılandırılmamış hata → jenerik Türkçe 500', async () => {
    const route = withIntegrationRoute(vi.fn(async () => {
      throw new Error('internal db detail leak')
    }))
    const res = await route(makeRequest())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'İşlem sırasında beklenmeyen bir hata oluştu' })
  })
})
