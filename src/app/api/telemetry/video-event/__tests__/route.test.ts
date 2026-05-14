import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md Faz 1.
 *
 * Telemetry endpoint'in invarianları:
 *   1. `error` ve `stalled` event'leri her zaman logger.error/warn ile düşer (sampling yok)
 *   2. Rate limit dolduğunda 429 döner, log yazılmaz
 *   3. Body validation: `event` field'ı bilinmeyen değer ise 400 — kötü niyetli payload'u tut
 *   4. Auth: withStaffRoute wrapper'ı kullanılır (staff/admin/super_admin)
 */

const { loggerMock, rateLimitMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  rateLimitMock: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: rateLimitMock }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
  ApiError: class extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: (handler: (ctx: {
    request: Request
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
  }) => Promise<Response>) => {
    return async (request: Request) => {
      try {
        return await handler({
          request,
          dbUser: { id: 'user-1', role: 'staff', organizationId: 'org-1' },
          organizationId: 'org-1',
        })
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500
        return Response.json({ error: (err as Error).message }, { status })
      }
    }
  },
}))

import { POST } from '../route'

function eventRequest(body: unknown): Request {
  return new Request('http://localhost/api/telemetry/video-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telemetry/video-event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue(true)
    // Math.random'ı her sample'da 0.99 yap → SAMPLED_RATE (0.2) eşik altında, ALWAYS_REPORT
    // dışındakiler skip edilir. Always-report event'lerinin gerçekten her zaman log'a düştüğünü
    // izole olarak test eder.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })

  it('error event her zaman logger.error ile düşer (sampling bypass)', async () => {
    const res = await POST(eventRequest({
      event: 'error',
      errorCode: 2,
      errorMessage: 'MEDIA_ERR_NETWORK',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sampled).toBe(true)
    expect(loggerMock.error).toHaveBeenCalledWith(
      'video-telemetry',
      expect.stringContaining('MEDIA_ERR'),
      expect.objectContaining({ event: 'error', errorCode: 2 }),
    )
  })

  it('stalled event her zaman logger.warn ile düşer', async () => {
    const res = await POST(eventRequest({ event: 'stalled' }))
    expect(res.status).toBe(200)
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'video-telemetry',
      expect.stringContaining('stalled'),
      expect.any(Object),
    )
  })

  it('canplay event örnekleme ile skip edilir (Math.random > 0.2)', async () => {
    const res = await POST(eventRequest({ event: 'canplay' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sampled).toBe(false)
    expect(loggerMock.info).not.toHaveBeenCalled()
  })

  it('rate limit doluysa 429 döner', async () => {
    rateLimitMock.mockResolvedValueOnce(false)
    const res = await POST(eventRequest({ event: 'error' }))
    expect(res.status).toBe(429)
  })

  it('geçersiz event tipi → 400', async () => {
    const res = await POST(eventRequest({ event: 'invalid_event_name' }))
    expect(res.status).toBe(400)
  })

  it('eksik body → 400', async () => {
    const req = new Request('http://localhost/api/telemetry/video-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
