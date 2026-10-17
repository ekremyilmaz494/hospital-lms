import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const create = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { contactMessage: { create: (...a: unknown[]) => create(...a) } } }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('../route')

const base = {
  firstName: 'Ayşe',
  lastName: 'Kaya',
  email: 'ayse@hastane.example',
  phone: '0500 000 00 00',
  organizationName: 'Örnek Hastanesi',
  staffCount: '100-250',
  message: 'Demo rica ederiz',
}

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/public/demo-request', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    }),
  )
}

describe('POST /api/public/demo-request — atıf', () => {
  beforeEach(() => create.mockReset().mockResolvedValue({}))

  it('geçerli atfı ContactMessage kaydına yazar', async () => {
    const res = await post({
      ...base,
      attribution: { utmSource: 'linkedin', utmCampaign: 'ekim', landingPath: '/', referrerHost: 'www.linkedin.com' },
    })
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0].data).toMatchObject({
      source: 'demo',
      utmSource: 'linkedin',
      utmCampaign: 'ekim',
      landingPath: '/',
      referrerHost: 'www.linkedin.com',
    })
  })

  it('geçersiz atıf isteği reddetmez, yalnız kaydedilmez', async () => {
    const res = await post({ ...base, attribution: { landingPath: 'javascript:alert(1)' } })
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0].data).not.toHaveProperty('landingPath')
  })

  it('atıfsız eski istemciler aynen çalışır', async () => {
    const res = await post(base)
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0].data).not.toHaveProperty('utmSource')
  })
})
