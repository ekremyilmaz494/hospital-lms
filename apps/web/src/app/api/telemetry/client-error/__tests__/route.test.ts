import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * client-error backstop invariantları:
 *   1. Geçerli hata → logger.error('client-error', ...) + 204
 *   2. Rate limit dolu → 204, LOG YOK (crash-loop flood koruması)
 *   3. Gövde > 4KB → 204, LOG YOK (log-şişirme koruması)
 *   4. Geçersiz JSON / boş → 204, LOG YOK (best-effort; boundary'ye hata sızmaz)
 *   5. Kontrol karakterleri (newline) temizlenir → log-injection önlenir
 *   6. Uzun alanlar kısaltılır (message ≤500)
 *   7. IP x-forwarded-for'dan çözülür ve loglanır
 */

const { loggerMock, rateLimitMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  rateLimitMock: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: rateLimitMock }))

import { POST } from '../route'

function errReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/telemetry/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/telemetry/client-error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue(true)
  })

  it('geçerli hata → logger.error + 204', async () => {
    const res = await POST(errReq({
      message: 'Cannot read properties of undefined',
      digest: 'abc123',
      stack: 'Error: x\n  at foo',
      url: 'http://localhost/staff/trainings',
    }))
    expect(res.status).toBe(204)
    expect(loggerMock.error).toHaveBeenCalledWith(
      'client-error',
      'Cannot read properties of undefined',
      expect.objectContaining({
        digest: 'abc123',
        url: 'http://localhost/staff/trainings',
        ip: '203.0.113.9',
      }),
    )
  })

  it('IP rate limit dolu → 204, LOG YOK', async () => {
    rateLimitMock.mockResolvedValueOnce(false) // ilk çağrı = IP bucket
    const res = await POST(errReq({ message: 'boom' }))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('GLOBAL rate limit dolu (XFF-spoof backstop) → 204, LOG YOK', async () => {
    rateLimitMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false) // IP geçer, global düşer
    const res = await POST(errReq({ message: 'boom' }))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('content-length > 4KB → 204, LOG YOK (gövde belleğe okunmadan reddedilir)', async () => {
    const res = await POST(errReq({ message: 'boom' }, { 'content-length': '5000' }))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('gövde > 4KB (content-length yok/chunked) → 204, LOG YOK', async () => {
    const huge = { message: 'x'.repeat(5000) }
    const res = await POST(errReq(huge))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('geçersiz JSON → 204, LOG YOK', async () => {
    const res = await POST(errReq('not-json{{'))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('boş/null gövde → 204, LOG YOK', async () => {
    const res = await POST(errReq('null'))
    expect(res.status).toBe(204)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('kontrol karakterleri (newline) mesajda boşluğa çevrilir', async () => {
    await POST(errReq({ message: 'line1\nline2\r\ttab' }))
    const loggedMessage = loggerMock.error.mock.calls[0]?.[1] as string
    expect(loggedMessage).not.toMatch(/[\n\r\t]/)
    expect(loggedMessage).toBe('line1 line2 tab')
  })

  it('uzun message 500 karaktere kısaltılır', async () => {
    await POST(errReq({ message: 'a'.repeat(900) }))
    const loggedMessage = loggerMock.error.mock.calls[0]?.[1] as string
    expect(loggedMessage.length).toBe(500)
  })

  it('message olmayan (string-dışı) → "(boş mesaj)" ile loglanır', async () => {
    await POST(errReq({ digest: 'd1' }))
    expect(loggerMock.error).toHaveBeenCalledWith(
      'client-error',
      '(boş mesaj)',
      expect.objectContaining({ digest: 'd1' }),
    )
  })
})
