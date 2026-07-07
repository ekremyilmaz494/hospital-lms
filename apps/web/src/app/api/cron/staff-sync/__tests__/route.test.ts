import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

/**
 * GET /api/cron/staff-sync — zamanlanmış İK/HBYS pull senkronu.
 *
 * Kritik güvenceler:
 *  - CRON_SECRET doğrulaması (assertCronAuth) — yanlış/eksik → 401.
 *  - Vadesi gelen entegrasyon işlenir; vadesi gelmeyen (interval dolmadı) atlanır.
 *  - Hata izolasyonu: 1. entegrasyon patlasa da 2. koşar.
 */

const { prismaMock, runPullMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: { staffIntegration: { findMany: vi.fn() } },
  runPullMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/integration/pull', () => ({
  runPullForIntegration: (...a: unknown[]) => runPullMock(...a),
}))

import { GET } from '../route'

const OLD_SECRET = process.env.CRON_SECRET

function req(secret?: string) {
  return new Request('http://localhost/api/cron/staff-sync', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

function integrationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-a',
    organizationId: 'org-a',
    syncMode: 'delta',
    deactivateMissing: false,
    deactivateThresholdPct: 20,
    fieldMapping: null,
    defaults: null,
    pullBaseUrl: 'https://hbys-a.example.com/api',
    pullAuthType: 'bearer',
    pullCredentialsEncrypted: 'enc-a',
    pullIntervalMinutes: 60,
    pullPagination: null,
    lastRunAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret' // secret-scanner-disable-line
  prismaMock.staffIntegration.findMany.mockResolvedValue([])
  runPullMock.mockResolvedValue({ ok: true, runId: 'run-x' })
})

afterAll(() => {
  process.env.CRON_SECRET = OLD_SECRET
})

describe('GET /api/cron/staff-sync — auth', () => {
  it('Authorization header yoksa 401, DB\'ye gidilmez', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(prismaMock.staffIntegration.findMany).not.toHaveBeenCalled()
  })

  it('yanlış CRON_SECRET → 401', async () => {
    const res = await GET(req('yanlis-secret'))
    expect(res.status).toBe(401)
    expect(runPullMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/staff-sync — vade filtresi', () => {
  it('vadesi gelen işlenir (lastRunAt null veya interval dolmuş), gelmeyen atlanır', async () => {
    const now = Date.now()
    prismaMock.staffIntegration.findMany.mockResolvedValue([
      // hiç koşmamış → vadesi gelmiş
      integrationRow({ id: 'int-a', lastRunAt: null }),
      // 10 dk önce koştu, interval 60 dk → vadesi GELMEMİŞ
      integrationRow({ id: 'int-b', organizationId: 'org-b', lastRunAt: new Date(now - 10 * 60_000) }),
      // 2 saat önce koştu, interval 60 dk → vadesi gelmiş
      integrationRow({ id: 'int-c', organizationId: 'org-c', lastRunAt: new Date(now - 120 * 60_000) }),
    ])

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ processed: 2, succeeded: 2, failed: 0 })
    expect(runPullMock).toHaveBeenCalledTimes(2)

    const calledIds = runPullMock.mock.calls.map((c) => (c[0] as { id: string }).id)
    expect(calledIds).toEqual(['int-a', 'int-c'])
    // Her koşu 'schedule' tetiğiyle
    expect(runPullMock.mock.calls.every((c) => c[1] === 'schedule')).toBe(true)
  })

  it('yalnız aktif + pullBaseUrl dolu pull entegrasyonları sorgulanır', async () => {
    await GET(req('test-secret'))

    expect(prismaMock.staffIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel: 'pull', isActive: true, pullBaseUrl: { not: null } },
      }),
    )
  })

  it('vadesi gelen yoksa processed:0 döner, runPull hiç çağrılmaz', async () => {
    prismaMock.staffIntegration.findMany.mockResolvedValue([
      integrationRow({ lastRunAt: new Date() }),
    ])

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(data).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    expect(runPullMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/staff-sync — hata izolasyonu', () => {
  it('1. entegrasyon beklenmedik şekilde patlarsa 2. yine koşar', async () => {
    prismaMock.staffIntegration.findMany.mockResolvedValue([
      integrationRow({ id: 'int-a' }),
      integrationRow({ id: 'int-b', organizationId: 'org-b' }),
    ])
    runPullMock
      .mockRejectedValueOnce(new Error('beklenmeyen patlama'))
      .mockResolvedValueOnce({ ok: true, runId: 'run-b' })

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ processed: 2, succeeded: 1, failed: 1 })
    expect(runPullMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.error).toHaveBeenCalledWith(
      'staff-sync-cron',
      expect.any(String),
      expect.objectContaining({ integrationId: 'int-a' }),
    )
  })

  it('runPull {ok:false} dönerse failed sayılır (rethrow edilmeyen hata yolu)', async () => {
    prismaMock.staffIntegration.findMany.mockResolvedValue([
      integrationRow({ id: 'int-a' }),
      integrationRow({ id: 'int-b', organizationId: 'org-b' }),
    ])
    runPullMock
      .mockResolvedValueOnce({ ok: false, error: 'İK API isteği başarısız' })
      .mockResolvedValueOnce({ ok: true, runId: 'run-b' })

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(data).toEqual({ processed: 2, succeeded: 1, failed: 1 })
  })
})
