import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POST /api/admin/integration/test-connection — İK/HBYS pull bağlantı testi.
 *
 * Kritik güvenceler:
 *  - Feature gate (staffIntegration) kapalıysa 403.
 *  - Pull config yoksa 404.
 *  - Örnek satırlar MASKELİ döner — ham e-posta/telefon/isim yanıtta sızmaz.
 *  - Fetch hatası test SONUCUDUR → 200 + { ok:false, message }.
 *  - Rate limit (10/saat) → 429.
 */

const { prismaMock, checkFeatureMock, checkRateLimitMock, fetchRemoteMock, auditMock } = vi.hoisted(() => ({
  prismaMock: { staffIntegration: { findUnique: vi.fn() } },
  checkFeatureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  fetchRemoteMock: vi.fn(),
  auditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-gate', () => ({ checkFeature: (...a: unknown[]) => checkFeatureMock(...a) }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/integration/pull', () => ({
  fetchStaffFromRemote: (...a: unknown[]) => fetchRemoteMock(...a),
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
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
import { ApiError } from '@/lib/api-helpers'

function postRequest(): Request {
  return new Request('http://localhost/api/admin/integration/test-connection', { method: 'POST' })
}

function pullConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    pullBaseUrl: 'https://hbys.example.com/api/personel',
    pullAuthType: 'bearer',
    pullCredentialsEncrypted: 'enc-blob',
    pullPagination: null,
    ...overrides,
  }
}

const SAMPLE_ROWS = [
  {
    sicilNo: 'P-1001',
    ad: 'Ayşe',
    eposta: 'ayse.yilmaz@hastane.com',
    telefon: '0553 953 06 96',
    aktif: true,
    yas: 34,
    ekstra: null,
  },
  { sicilNo: 'P-1002', ad: 'Mehmet', eposta: 'mehmet@hastane.com', telefon: '05321112233', aktif: false, yas: 41, ekstra: null },
  { sicilNo: 'P-1003', ad: 'Zeynep', eposta: 'zeynep@hastane.com', telefon: '05334445566', aktif: true, yas: 28, ekstra: null },
  { sicilNo: 'P-1004', ad: 'Deniz', eposta: 'deniz@hastane.com', telefon: '05357778899', aktif: true, yas: 30, ekstra: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  checkFeatureMock.mockResolvedValue(true)
  checkRateLimitMock.mockResolvedValue(true)
  prismaMock.staffIntegration.findUnique.mockResolvedValue(pullConfigRow())
  fetchRemoteMock.mockResolvedValue({ rows: SAMPLE_ROWS, pages: 1, truncated: false })
})

describe('POST /api/admin/integration/test-connection — guard\'lar', () => {
  it('feature kapalı → 403, DB\'ye ve uzak API\'ye gidilmez', async () => {
    checkFeatureMock.mockResolvedValue(false)

    const res = await POST(postRequest())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe('Personel entegrasyonu planınızda etkin değil.')
    expect(prismaMock.staffIntegration.findUnique).not.toHaveBeenCalled()
    expect(fetchRemoteMock).not.toHaveBeenCalled()
  })

  it('rate limit aşıldı → 429', async () => {
    checkRateLimitMock.mockResolvedValue(false)

    const res = await POST(postRequest())

    expect(res.status).toBe(429)
    expect(checkRateLimitMock).toHaveBeenCalledWith('integration:test:org-1', 10, 3600)
    expect(fetchRemoteMock).not.toHaveBeenCalled()
  })

  it('pull config yok → 404', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(null)

    const res = await POST(postRequest())
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Pull yapılandırması bulunamadı')
    expect(fetchRemoteMock).not.toHaveBeenCalled()
  })

  it('config var ama pullBaseUrl boş → yine 404', async () => {
    prismaMock.staffIntegration.findUnique.mockResolvedValue(pullConfigRow({ pullBaseUrl: null }))

    const res = await POST(postRequest())

    expect(res.status).toBe(404)
    expect(fetchRemoteMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/integration/test-connection — happy path (maskeli örnek)', () => {
  it('tek sayfa çeker, ilk 3 satırı maskeleyerek döner; ham PII sızmaz', async () => {
    const res = await POST(postRequest())
    const raw = await res.text()
    const data = JSON.parse(raw)

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.totalFetched).toBe(4)
    expect(data.truncated).toBe(false)
    expect(data.sampleRows).toHaveLength(3) // 4 satırdan yalnız ilk 3'ü
    expect(data.sampleFields).toEqual(
      expect.arrayContaining(['sicilNo', 'ad', 'eposta', 'telefon', 'aktif', 'yas']),
    )

    // maxPages:1 — bağlantı testi tüm listeyi ÇEKMEZ
    expect(fetchRemoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ pullBaseUrl: 'https://hbys.example.com/api/personel' }),
      { maxPages: 1 },
    )

    // Maskeleme: e-posta → maskEmail, telefon → maskPhone, string → 2 karakter + ***
    const first = data.sampleRows[0]
    expect(first.eposta).toBe('ay*********@hastane.com')
    expect(first.telefon).toBe('***0696')
    expect(first.ad).toBe('Ay***')
    expect(first.sicilNo).toBe('P-***')
    // sayı/boolean/null aynen
    expect(first.aktif).toBe(true)
    expect(first.yas).toBe(34)
    expect(first.ekstra).toBeNull()

    // Ham değerler yanıtın HİÇBİR yerinde görünmez
    expect(raw).not.toContain('ayse.yilmaz@hastane.com')
    expect(raw).not.toContain('0553 953 06 96')
    expect(raw).not.toContain('Ayşe')
    expect(raw).not.toContain('P-1001')
  })

  it('audit integration.test-connection ile yazılır — ham satır audit\'e SIZMAZ', async () => {
    await POST(postRequest())

    expect(auditMock).toHaveBeenCalledTimes(1)
    const payload = auditMock.mock.calls[0][0] as { action: string; entityId: string }
    expect(payload.action).toBe('integration.test-connection')
    expect(payload.entityId).toBe('int-1')
    expect(JSON.stringify(payload)).not.toContain('ayse.yilmaz@hastane.com')
  })
})

describe('POST /api/admin/integration/test-connection — bağlantı hatası', () => {
  it('fetch hatası → 200 + { ok:false, message } (test sonucu, HTTP hatası değil)', async () => {
    fetchRemoteMock.mockRejectedValue(
      new ApiError('İK API isteği başarısız (HTTP 401): hbys.example.com', 502),
    )

    const res = await POST(postRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.message).toBe('İK API isteği başarısız (HTTP 401): hbys.example.com')

    const payload = auditMock.mock.calls[0][0] as { newData: { ok: boolean } }
    expect(payload.newData.ok).toBe(false)
  })

  it('ApiError olmayan beklenmedik hata → generic Türkçe mesaj (iç detay sızmaz)', async () => {
    fetchRemoteMock.mockRejectedValue(new Error('ECONNRESET at TCPSocket._read'))

    const res = await POST(postRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.message).toBe('İK API bağlantı testi başarısız — sunucuya ulaşılamadı.')
    expect(JSON.stringify(data)).not.toContain('ECONNRESET')
  })
})
