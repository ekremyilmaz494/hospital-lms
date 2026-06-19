import { describe, it, expect, vi, beforeEach } from 'vitest'

// withAdminRoute → org context enjekte et (wrapper'ı sarmadan handler'ı çağır)
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: { organizationId: string }) => Promise<Response>) => {
    return async () => handler({ organizationId: 'org-1' })
  },
}))

const auditFindMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { findMany: (...a: unknown[]) => auditFindMany(...a) } },
}))

const checkRateLimitMock = vi.fn()
vi.mock('@/lib/redis', () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { GET } from '../route'

function call() {
  return GET(new Request('http://localhost/api/admin/audit-logs/verify') as never)
}

describe('GET /api/admin/audit-logs/verify — rate-limit yönü (regresyon)', () => {
  beforeEach(() => {
    auditFindMany.mockReset()
    checkRateLimitMock.mockReset()
  })

  it('checkRateLimit=true (İZİNLİ) → 429 DÖNMEZ, doğrulamaya devam eder', async () => {
    // checkRateLimit true = istek izinli (redis.ts semantiği). Eski ters mantık burada
    // 429 dönüyordu — ilk çağrı her zaman kırıktı. Bu test o regresyonu engeller.
    checkRateLimitMock.mockResolvedValue(true)
    auditFindMany.mockResolvedValue([]) // boş zincir → verified:true

    const res = await call()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.verified).toBe(true)
    expect(auditFindMany).toHaveBeenCalled()
  })

  it('checkRateLimit=false (limit aşıldı) → 429', async () => {
    checkRateLimitMock.mockResolvedValue(false)

    const res = await call()
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain('5 dakikada bir')
    // Limit aşıldıysa DB'ye gidilmez
    expect(auditFindMany).not.toHaveBeenCalled()
  })
})
