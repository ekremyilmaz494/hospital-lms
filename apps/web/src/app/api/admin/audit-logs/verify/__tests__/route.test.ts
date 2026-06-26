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
import { computeAuditHash } from '@/lib/api-helpers'

function call() {
  return GET(new Request('http://localhost/api/admin/audit-logs/verify') as never)
}

interface ChainRow {
  id: string
  hash: string | null
  prevHash: string | null
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  createdAt: Date
}

/** Gerçek computeAuditHash ile geçerli bir hash zinciri kurar (doğrulamayla aynı serileştirme). */
function buildChain(n: number): ChainRow[] {
  const rows: ChainRow[] = []
  let prev: string | null = null
  for (let i = 0; i < n; i++) {
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, i))
    const action = `act_${i}`
    const entityType = 'thing'
    const entityId = `e_${i}`
    const userId = `u_${i}`
    const hash = computeAuditHash({ prevHash: prev, action, entityType, entityId, userId, createdAt: createdAt.toISOString() })
    rows.push({ id: `id_${i}`, hash, prevHash: prev, action, entityType, entityId, userId, createdAt })
    prev = hash
  }
  return rows
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

describe('GET /api/admin/audit-logs/verify — zincir bütünlüğü', () => {
  beforeEach(() => {
    auditFindMany.mockReset()
    checkRateLimitMock.mockReset()
    checkRateLimitMock.mockResolvedValue(true) // İZİNLİ
  })

  it('geçerli zincir → verified:true, tüm kayıtlar sayılır', async () => {
    const chain = buildChain(5)
    auditFindMany.mockResolvedValue(chain)

    const res = await call()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.verified).toBe(true)
    expect(data.totalRecords).toBe(5)
  })

  it('genesis silinmiş (rotasyon) — ilk kayıt prevHash != null ama zincir tutarlı → verified:true', async () => {
    // 1 yıllık audit rotasyonu zincirin BAŞINI siler; kalan ilk kayıt "çapa" olur.
    const chain = buildChain(5).slice(1)
    expect(chain[0].prevHash).not.toBeNull()
    auditFindMany.mockResolvedValue(chain)

    const res = await call()
    const data = await res.json()

    expect(data.verified).toBe(true)
    expect(data.totalRecords).toBe(4)
  })

  it('içerik kurcalanmış (hash uyuşmuyor) → verified:false, brokenAt o kayıt', async () => {
    const chain = buildChain(5)
    chain[2] = { ...chain[2], action: 'KURCALANDI' } // hash sabit kaldı → bütünlük bozuk
    auditFindMany.mockResolvedValue(chain)

    const res = await call()
    const data = await res.json()

    expect(data.verified).toBe(false)
    expect(data.brokenAt.id).toBe('id_2')
  })

  it('zincirin ORTASINDAN kayıt silinmiş (bağ kopuk) → verified:false', async () => {
    const chain = buildChain(5)
    const withHole = [chain[0], chain[1], chain[3], chain[4]] // id_2 silindi
    auditFindMany.mockResolvedValue(withHole)

    const res = await call()
    const data = await res.json()

    expect(data.verified).toBe(false)
    expect(data.brokenAt.id).toBe('id_3') // bağ id_3'te kopar
  })

  it('hash\'siz (eski) kayıtlar atlanır, sonrası çapa olur → verified:true', async () => {
    const chain = buildChain(3)
    const hashless: ChainRow = {
      id: 'old', hash: null, prevHash: null, action: 'legacy',
      entityType: 'thing', entityId: null, userId: null,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 30)),
    }
    auditFindMany.mockResolvedValue([chain[0], hashless, chain[1], chain[2]])

    const res = await call()
    const data = await res.json()

    expect(data.verified).toBe(true)
    expect(data.totalRecords).toBe(4)
  })
})
