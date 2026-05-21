import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  classifyExamPostResult,
  isFatalExamPostKind,
  postWithRetry,
} from '../exam-fetch'

// ════════════════════════════════════════════════════════════════════
// classifyExamPostResult
// ════════════════════════════════════════════════════════════════════

describe('classifyExamPostResult', () => {
  const mkRes = (status: number) => new Response(null, { status: status === 204 ? 204 : status })

  it('2xx → ok', () => {
    expect(classifyExamPostResult(new Response('{}', { status: 200 }))).toBe('ok')
    expect(classifyExamPostResult(mkRes(204))).toBe('ok')
  })

  it('401 → session-expired', () => {
    expect(classifyExamPostResult(mkRes(401))).toBe('session-expired')
  })

  it('400 → phase-invalid', () => {
    expect(classifyExamPostResult(mkRes(400))).toBe('phase-invalid')
  })

  it('404 → content-gone', () => {
    expect(classifyExamPostResult(mkRes(404))).toBe('content-gone')
  })

  it('423 → locked', () => {
    expect(classifyExamPostResult(mkRes(423))).toBe('locked')
  })

  it('5xx ve 429 → transient', () => {
    expect(classifyExamPostResult(mkRes(500))).toBe('transient')
    expect(classifyExamPostResult(mkRes(503))).toBe('transient')
    expect(classifyExamPostResult(mkRes(429))).toBe('transient')
  })

  it('fetch throw (ağ hatası / abort) → transient', () => {
    expect(classifyExamPostResult(new TypeError('Failed to fetch'))).toBe('transient')
    expect(classifyExamPostResult(new DOMException('aborted', 'AbortError'))).toBe('transient')
    expect(classifyExamPostResult(undefined)).toBe('transient')
  })
})

describe('isFatalExamPostKind', () => {
  it('kalıcı hatalar fatal', () => {
    expect(isFatalExamPostKind('session-expired')).toBe(true)
    expect(isFatalExamPostKind('phase-invalid')).toBe(true)
    expect(isFatalExamPostKind('content-gone')).toBe(true)
    expect(isFatalExamPostKind('locked')).toBe(true)
  })

  it('ok ve transient fatal değil', () => {
    expect(isFatalExamPostKind('ok')).toBe(false)
    expect(isFatalExamPostKind('transient')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════
// postWithRetry
// ════════════════════════════════════════════════════════════════════

describe('postWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** fetch'i sıralı yanıtlarla mock'lar; her çağrıda dizinin bir sonrakini döner. */
  function mockFetchSequence(results: (Response | Error)[]) {
    let i = 0
    return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const r = results[Math.min(i, results.length - 1)]
      i++
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r)
    })
  }

  it('ilk denemede başarı → ok, tek fetch çağrısı', async () => {
    const fetchMock = mockFetchSequence([new Response(JSON.stringify({ saved: true }), { status: 200 })])
    const result = await postWithRetry('/api/x', { a: 1 })
    expect(result.kind).toBe('ok')
    expect(result.data).toEqual({ saved: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('204 yanıtı → ok, data null', async () => {
    mockFetchSequence([new Response(null, { status: 204 })])
    const result = await postWithRetry('/api/x', {})
    expect(result.kind).toBe('ok')
    expect(result.data).toBeNull()
  })

  it('geçici hata 2 kez sonra başarı → 3 fetch çağrısı', async () => {
    const fetchMock = mockFetchSequence([
      new Response(null, { status: 500 }),
      new TypeError('Failed to fetch'),
      new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
    ])
    const promise = postWithRetry('/api/x', {}, { retries: 2, backoff: [10, 20] })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.kind).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('tüm denemeler geçici hata → transient, retries+1 fetch çağrısı', async () => {
    const fetchMock = mockFetchSequence([new Response(null, { status: 503 })])
    const promise = postWithRetry('/api/x', {}, { retries: 2, backoff: [10, 20] })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.kind).toBe('transient')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('kalıcı hata (400) → retry YAPILMAZ, tek fetch çağrısı', async () => {
    const fetchMock = mockFetchSequence([new Response(null, { status: 400 })])
    const promise = postWithRetry('/api/x', {}, { retries: 2 })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.kind).toBe('phase-invalid')
    expect(result.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('kalıcı hata (404) → content-gone, retry yok', async () => {
    const fetchMock = mockFetchSequence([new Response(null, { status: 404 })])
    const promise = postWithRetry('/api/x', {}, { retries: 2 })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.kind).toBe('content-gone')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborted signal → fetch çağrılmadan transient döner', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const controller = new AbortController()
    controller.abort()
    const result = await postWithRetry('/api/x', {}, { signal: controller.signal })
    expect(result.kind).toBe('transient')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
