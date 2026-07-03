import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * İK/HBYS ZAMANLANMIŞ PULL adaptörü — fetchStaffFromRemote + runPullForIntegration.
 *
 * Kritik güvenceler:
 *  - 3 auth tipi doğru HTTP başlığını üretir (bearer/basic/header_key).
 *  - page/offset/cursor sayfalaması + itemsPath nokta-yolu.
 *  - SSRF: bulutta http/localhost/özel-IP REDDEDİLİR; on-prem'de serbest.
 *  - Sayfa/satır tavanı → truncated:true (sessiz kırpma yok, warn loglanır).
 *  - Başarısız sayfada 1 retry; ikinci hata Türkçe ApiError.
 *  - lastRunStatus 30 karaktere kırpılır; hata rethrow edilmez ({ok:false}).
 */

const { decryptMock, isOnPremMock, runSyncMock, prismaMock, loggerMock } = vi.hoisted(() => ({
  decryptMock: vi.fn(),
  isOnPremMock: vi.fn(),
  runSyncMock: vi.fn(),
  prismaMock: { staffIntegration: { update: vi.fn() } },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/crypto', () => ({ decrypt: (...a: unknown[]) => decryptMock(...a) }))
vi.mock('@/lib/deployment', () => ({ isOnPrem: () => isOnPremMock() }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/api-helpers', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))
vi.mock('@/lib/integration/ingest', () => ({ runSync: (...a: unknown[]) => runSyncMock(...a) }))

import { fetchStaffFromRemote, runPullForIntegration, assertSafePullUrl } from '../pull'
import type { PullIntegration } from '../pull'

const fetchMock = vi.fn()

function jsonPage(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function makeIntegration(overrides: Partial<PullIntegration> = {}): PullIntegration {
  return {
    id: 'int-1',
    organizationId: 'org-1',
    syncMode: 'delta',
    deactivateMissing: false,
    deactivateThresholdPct: 20,
    fieldMapping: null,
    defaults: null,
    pullBaseUrl: 'https://hbys.example.com/api/personel',
    pullAuthType: 'bearer',
    pullCredentialsEncrypted: 'enc-blob',
    pullPagination: null,
    ...overrides,
  }
}

/** fetch mock'unun n. çağrısının URL ve header'larını okur. */
function fetchCall(n: number): { url: URL; headers: Record<string, string> } {
  const [urlArg, init] = fetchMock.mock.calls[n] as [URL | string, { headers: Record<string, string> }]
  return { url: new URL(String(urlArg)), headers: init.headers }
}

function completedSync(totalRows: number) {
  return {
    runId: 'run-1',
    status: 'completed',
    counts: {
      totalRows, createdRows: totalRows, updatedRows: 0, deactivatedRows: 0,
      reactivatedRows: 0, skippedRows: 0, failedRows: 0,
    },
    rowResults: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  isOnPremMock.mockReturnValue(false)
  decryptMock.mockReturnValue(JSON.stringify({ token: 'tok-123' }))
  prismaMock.staffIntegration.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── SSRF koruması ─────────────────────────────────────────────────────────

describe('assertSafePullUrl — SSRF koruması', () => {
  it('bulutta http reddedilir (https zorunlu)', () => {
    expect(() => assertSafePullUrl('http://hbys.example.com/api')).toThrow('https:// ile başlamalıdır')
  })

  it.each([
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://0.0.0.0/api',
    'https://10.0.0.5/api',
    'https://172.20.1.2/api',
    'https://172.16.0.1/api',
    'https://192.168.1.10/api',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/api',
    'https://hbys.hastane.local/api',
    'https://his.internal/api',
  ])('bulutta yerel/özel hedef reddedilir: %s', (url) => {
    expect(() => assertSafePullUrl(url)).toThrow('yerel/özel')
  })

  it('bulutta public https adres kabul edilir', () => {
    const url = assertSafePullUrl('https://hbys.example.com/api/personel')
    expect(url.hostname).toBe('hbys.example.com')
  })

  it('172.32.x özel aralık DEĞİL (172.16-31 sınırı doğru)', () => {
    expect(() => assertSafePullUrl('https://172.32.0.1/api')).not.toThrow()
  })

  it('on-prem: http + özel IP serbest (HIS LAN), ama http(s) dışı protokol yasak', () => {
    isOnPremMock.mockReturnValue(true)
    expect(() => assertSafePullUrl('http://192.168.1.50/his/api')).not.toThrow()
    expect(() => assertSafePullUrl('http://10.0.0.7:8080/api')).not.toThrow()
    expect(() => assertSafePullUrl('ftp://192.168.1.50/dosya')).toThrow('http:// veya https://')
  })

  it('geçersiz URL → Türkçe hata', () => {
    expect(() => assertSafePullUrl('bu bir url değil')).toThrow('geçerli bir URL değil')
  })

  it('fetchStaffFromRemote yasaklı URL için fetch ÇAĞIRMAZ', async () => {
    await expect(
      fetchStaffFromRemote(makeIntegration({ pullBaseUrl: 'https://10.1.2.3/api' })),
    ).rejects.toThrow('yerel/özel')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Kimlik doğrulama başlıkları ───────────────────────────────────────────

describe('fetchStaffFromRemote — auth başlıkları', () => {
  it('bearer → Authorization: Bearer <token>', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ firstName: 'Ali' }]))

    await fetchStaffFromRemote(makeIntegration())

    expect(decryptMock).toHaveBeenCalledWith('enc-blob')
    expect(fetchCall(0).headers.Authorization).toBe('Bearer tok-123')
  })

  it('basic → Authorization: Basic base64(user:pass)', async () => {
    decryptMock.mockReturnValue(JSON.stringify({ username: 'klx', password: 's3cret' }))
    fetchMock.mockResolvedValueOnce(jsonPage([]))

    await fetchStaffFromRemote(makeIntegration({ pullAuthType: 'basic' }))

    expect(fetchCall(0).headers.Authorization).toBe(
      `Basic ${Buffer.from('klx:s3cret').toString('base64')}`,
    )
  })

  it('header_key → özel header, Authorization YOK', async () => {
    decryptMock.mockReturnValue(JSON.stringify({ headerName: 'X-Api-Key', key: 'k-77' }))
    fetchMock.mockResolvedValueOnce(jsonPage([]))

    await fetchStaffFromRemote(makeIntegration({ pullAuthType: 'header_key' }))

    const { headers } = fetchCall(0)
    expect(headers['X-Api-Key']).toBe('k-77')
    expect(headers.Authorization).toBeUndefined()
  })

  it('credential çözülemezse Türkçe hata, fetch çağrılmaz', async () => {
    decryptMock.mockImplementation(() => { throw new Error('bad key') })

    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('kimlik bilgileri çözülemedi')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Sayfalama ─────────────────────────────────────────────────────────────

describe('fetchStaffFromRemote — sayfalama', () => {
  it('page stili: 1\'den başlar, dolu sayfa → sonraki; eksik sayfa → dur', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage([{ a: 1 }, { a: 2 }]))
      .mockResolvedValueOnce(jsonPage([{ a: 3 }]))

    const result = await fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'page', pageSize: 2 },
    }))

    expect(result).toMatchObject({ pages: 2, truncated: false })
    expect(result.rows).toHaveLength(3)
    expect(fetchCall(0).url.searchParams.get('page')).toBe('1')
    expect(fetchCall(0).url.searchParams.get('size')).toBe('2')
    expect(fetchCall(1).url.searchParams.get('page')).toBe('2')
  })

  it('offset stili: offset her sayfada pageSize kadar artar', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage([{ a: 1 }, { a: 2 }]))
      .mockResolvedValueOnce(jsonPage([{ a: 3 }]))

    const result = await fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'offset', pageSize: 2 },
    }))

    expect(result.rows).toHaveLength(3)
    expect(fetchCall(0).url.searchParams.get('offset')).toBe('0')
    expect(fetchCall(1).url.searchParams.get('offset')).toBe('2')
  })

  it('cursor stili: ilk istek parametresiz, sonraki cursorPath değeriyle; null cursor → dur', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage({ data: { items: [{ a: 1 }, { a: 2 }], next: 'c-2' } }))
      .mockResolvedValueOnce(jsonPage({ data: { items: [{ a: 3 }], next: null } }))

    const result = await fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'cursor', itemsPath: 'data.items', cursorPath: 'data.next' },
    }))

    expect(result).toMatchObject({ pages: 2, truncated: false })
    expect(result.rows).toHaveLength(3)
    expect(fetchCall(0).url.searchParams.get('cursor')).toBeNull()
    expect(fetchCall(1).url.searchParams.get('cursor')).toBe('c-2')
  })

  it('cursor stili cursorPath olmadan yapılandırılamaz', async () => {
    await expect(fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'cursor', itemsPath: 'data.items' },
    }))).rejects.toThrow('cursorPath')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('itemsPath nokta-yoluyla sarmalanmış yanıttan dizi çıkarır', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage({ result: { personel: [{ ad: 'Ali' }] } }))

    const result = await fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'page', pageSize: 200, itemsPath: 'result.personel' },
    }))

    expect(result.rows).toEqual([{ ad: 'Ali' }])
  })

  it('itemsPath dizi bulamazsa Türkçe hata', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage({ result: { personel: 'dizi-degil' } }))

    await expect(fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'page', itemsPath: 'result.personel' },
    }))).rejects.toThrow('personel dizisi bulunamadı')
    expect(fetchMock).toHaveBeenCalledTimes(1) // parse hatasına retry YOK (fetch başarılıydı)
  })

  it('sayfalama yapılandırılmamışsa tek istek; yanıt dizi değilse Türkçe hata', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ a: 1 }]))
    const ok = await fetchStaffFromRemote(makeIntegration())
    expect(ok).toMatchObject({ pages: 1, truncated: false })
    expect(ok.rows).toEqual([{ a: 1 }])
    expect(fetchCall(0).url.searchParams.size).toBe(0)

    fetchMock.mockResolvedValueOnce(jsonPage({ data: [] }))
    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('personel dizisi değil')
  })
})

// ── Tavanlar ──────────────────────────────────────────────────────────────

describe('fetchStaffFromRemote — sayfa/satır tavanı', () => {
  it('maxPages tavanı: devam eden veri varken durur → truncated:true + warn', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonPage([{ a: 1 }])))

    const result = await fetchStaffFromRemote(
      makeIntegration({ pullPagination: { style: 'page', pageSize: 1 } }),
      { maxPages: 2 },
    )

    expect(result).toMatchObject({ pages: 2, truncated: true })
    expect(result.rows).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'staff-pull',
      expect.stringContaining('tavanına'),
      expect.objectContaining({ host: 'hbys.example.com' }),
    )
  })

  it('10.000 satır tavanı: dolu sayfalar sürerken durur → truncated:true', async () => {
    const bigPage = Array.from({ length: 1000 }, (_, i) => ({ sicil: i }))
    fetchMock.mockImplementation(() => Promise.resolve(jsonPage(bigPage)))

    const result = await fetchStaffFromRemote(makeIntegration({
      pullPagination: { style: 'offset', pageSize: 1000 },
    }))

    expect(result.rows).toHaveLength(10_000)
    expect(result.truncated).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(loggerMock.warn).toHaveBeenCalled()
  })

  it('warn logunda URL path/query YOK — yalnız host', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonPage([{ a: 1 }])))
    await fetchStaffFromRemote(
      makeIntegration({ pullPagination: { style: 'page', pageSize: 1 } }),
      { maxPages: 1 },
    )

    const serialized = JSON.stringify(loggerMock.warn.mock.calls)
    expect(serialized).not.toContain('/api/personel')
    expect(serialized).toContain('hbys.example.com')
  })
})

// ── Timeout / retry ───────────────────────────────────────────────────────

describe('fetchStaffFromRemote — hata/retry', () => {
  it('başarısız sayfa 1 kez yeniden denenir; ikincisi başarılıysa koşu sürer', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonPage([{ a: 1 }]))

    const result = await fetchStaffFromRemote(makeIntegration())

    expect(result.rows).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'staff-pull',
      expect.stringContaining('yeniden denenecek'),
      expect.objectContaining({ host: 'hbys.example.com' }),
    )
  })

  it('iki deneme de başarısızsa Türkçe ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('bağlanılamadı')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('timeout (AbortSignal.timeout) Türkçe zaman aşımı hatasına çevrilir', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    fetchMock.mockRejectedValue(timeoutErr)

    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('zaman aşımına uğradı')
  })

  it('HTTP hata kodu ve JSON olmayan content-type Türkçe hataya çevrilir', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('err', { status: 500 })))
    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('HTTP 500')

    fetchMock.mockImplementation(() => Promise.resolve(
      new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ))
    await expect(fetchStaffFromRemote(makeIntegration())).rejects.toThrow('JSON değil')
  })
})

// ── runPullForIntegration ─────────────────────────────────────────────────

describe('runPullForIntegration', () => {
  it('fetch → normalize (fieldMapping) → runSync → lastRunAt/lastRunStatus güncellenir', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ AD: 'Ali', SOYAD: 'Yılmaz', SICIL: 'P-1' }]))
    runSyncMock.mockResolvedValueOnce(completedSync(1))

    const result = await runPullForIntegration(
      makeIntegration({ fieldMapping: { AD: 'firstName', SOYAD: 'lastName', SICIL: 'externalId' } }),
      'schedule',
    )

    // status/counts admin "şimdi çalıştır" yanıtına taşınır (passthrough)
    expect(result).toMatchObject({ ok: true, runId: 'run-1', status: 'completed' })
    expect(result.counts).toMatchObject({ totalRows: 1 })
    const [records, opts] = runSyncMock.mock.calls[0] as [unknown[], Record<string, unknown>]
    expect(records).toEqual([{ firstName: 'Ali', lastName: 'Yılmaz', externalId: 'P-1' }])
    expect(opts).toMatchObject({
      organizationId: 'org-1',
      channel: 'pull',
      trigger: 'schedule',
      syncMode: 'delta',
      dryRun: false,
      deactivateMissing: false,
      deactivateThresholdPct: 20,
      integrationId: 'int-1',
      requestedById: null,
    })

    const updateArgs = prismaMock.staffIntegration.update.mock.calls[0][0] as {
      where: { id: string }
      data: { lastRunAt: Date; lastRunStatus: string }
    }
    expect(updateArgs.where).toEqual({ id: 'int-1' })
    expect(updateArgs.data.lastRunAt).toBeInstanceOf(Date)
    expect(updateArgs.data.lastRunStatus).toBe('completed: 1 satır')
  })

  it('manuel tetik: trigger=manual + requestedById runSync\'e taşınır', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ firstName: 'Ali', lastName: 'Kaya', externalId: 'P-2' }]))
    runSyncMock.mockResolvedValueOnce(completedSync(1))

    await runPullForIntegration(makeIntegration(), 'manual', 'admin-9')

    const opts = runSyncMock.mock.calls[0][1] as Record<string, unknown>
    expect(opts.trigger).toBe('manual')
    expect(opts.requestedById).toBe('admin-9')
    // opts verilmeden dryRun/force asla açılmaz (cron 'schedule' yolu güvenliği)
    expect(opts.dryRun).toBe(false)
    expect(opts.force).toBe(false)
  })

  it('manuel dry-run: dryRun/force runSync\'e geçer, lastRunAt/lastRunStatus\'a YAZILMAZ', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ firstName: 'Ali', lastName: 'Kaya', externalId: 'P-2' }]))
    runSyncMock.mockResolvedValueOnce(completedSync(1))

    const result = await runPullForIntegration(
      makeIntegration(), 'manual', 'admin-9', { dryRun: true, force: true },
    )

    expect(result.ok).toBe(true)
    const opts = runSyncMock.mock.calls[0][1] as Record<string, unknown>
    expect(opts).toMatchObject({ trigger: 'manual', dryRun: true, force: true, requestedById: 'admin-9' })
    // Dry-run kanal sağlığını temsil etmez — lastRun* güncellenmez
    expect(prismaMock.staffIntegration.update).not.toHaveBeenCalled()
  })

  it('hata rethrow EDİLMEZ: {ok:false} döner, lastRunStatus "failed: ..." ≤30 karakter', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const result = await runPullForIntegration(makeIntegration(), 'schedule')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('bağlanılamadı')
    expect(runSyncMock).not.toHaveBeenCalled()

    const updateArgs = prismaMock.staffIntegration.update.mock.calls[0][0] as {
      data: { lastRunAt: Date; lastRunStatus: string }
    }
    expect(updateArgs.data.lastRunStatus.startsWith('failed: ')).toBe(true)
    expect(updateArgs.data.lastRunStatus.length).toBeLessThanOrEqual(30)
    expect(updateArgs.data.lastRunAt).toBeInstanceOf(Date)
    expect(loggerMock.error).toHaveBeenCalled()
  })

  it('uzun başarı özeti de 30 karaktere kırpılır (VarChar30)', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ firstName: 'Ali', lastName: 'Kaya', externalId: 'P-3' }]))
    runSyncMock.mockResolvedValueOnce({
      ...completedSync(123456),
      status: 'completed_with_errors',
      counts: { ...completedSync(123456).counts, totalRows: 123456 },
    })

    await runPullForIntegration(makeIntegration(), 'schedule')

    const updateArgs = prismaMock.staffIntegration.update.mock.calls[0][0] as {
      data: { lastRunStatus: string }
    }
    // 'completed_with_errors: 123456 satır' > 30 → kırpılmış olmalı
    expect(updateArgs.data.lastRunStatus.length).toBeLessThanOrEqual(30)
    expect(updateArgs.data.lastRunStatus.startsWith('completed_with_errors')).toBe(true)
  })

  it('runSync kilidi (409) bile rethrow edilmez — cron diğer org\'lara devam edebilmeli', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage([{ firstName: 'Ali', lastName: 'Kaya', externalId: 'P-4' }]))
    runSyncMock.mockRejectedValueOnce(Object.assign(new Error('Bu kurum için devam eden bir senkron var.'), { status: 409 }))

    const result = await runPullForIntegration(makeIntegration(), 'schedule')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('devam eden bir senkron')
  })
})
