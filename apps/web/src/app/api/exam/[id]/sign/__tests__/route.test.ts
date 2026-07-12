import { describe, it, expect, vi, beforeEach } from 'vitest'
// Ortak personel (Faz 2.4): getStaffOrgIds tek-org döndürsün → myOrgs=[A], davranış eski tekil-org ile birebir.
vi.mock('@/lib/staff-orgs', () => ({ getStaffOrgIds: vi.fn(async (_userId, primaryOrgId) => [primaryOrgId]) }))

/**
 * sign/route.ts regresyon koruması (Plan: birden-fazla-agentla... Faz 4).
 *
 * Kilitlenen davranışlar:
 *   - Yalnız geçen (isPassed) ve henüz imzalanmamış deneme imzalanabilir.
 *   - Sorgu organizationId ile filtrelenir (multi-tenant guard).
 *   - Çift imza atomik updateMany guard'ı ile engellenir.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttempt: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => { try { return await req.json() } catch { return null } },
}))
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => handler({
      request,
      params: await params,
      dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
      organizationId: 'org-1',
      audit: vi.fn().mockResolvedValue(undefined),
    })
  },
}))

import { POST } from '../route'

function signRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/exam/att-1/sign', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const ctx = { params: Promise.resolve({ id: 'att-1' }) }
const ACK = { signatureData: 'ACKNOWLEDGED', signatureMethod: 'acknowledge' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.examAttempt.findFirst.mockResolvedValue({
    id: 'att-1', isPassed: true, signedAt: null, trainingId: 'tr-1', organizationId: 'org-1',
  })
  prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })
})

describe('POST /api/exam/[id]/sign', () => {
  it('geçen + imzalanmamış deneme imzalanır; sorgu organizationId ile filtreli', async () => {
    const res = await POST(signRequest(ACK), ctx)
    expect(res.status).toBe(200)

    const findArgs = prismaMock.examAttempt.findFirst.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(findArgs.where.organizationId).toEqual({ in: ['org-1'] }) // ortak personel: {in: myOrgs}
    expect(findArgs.where.userId).toBe('staff-1')

    const updArgs = prismaMock.examAttempt.updateMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(updArgs.where.organizationId).toBe('org-1') // yazma → EFEKTİF org (attempt'in org'u)
    expect(updArgs.where.signedAt).toBeNull() // atomik çift-imza guard
  })

  it('geçmemiş deneme imzalanamaz → 403', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue({
      id: 'att-1', isPassed: false, signedAt: null, trainingId: 'tr-1',
    })
    const res = await POST(signRequest(ACK), ctx)
    expect(res.status).toBe(403)
    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
  })

  it('zaten imzalanmış deneme → 409', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue({
      id: 'att-1', isPassed: true, signedAt: new Date(), trainingId: 'tr-1',
    })
    const res = await POST(signRequest(ACK), ctx)
    expect(res.status).toBe(409)
    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
  })

  it('deneme bulunamazsa → 404', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)
    const res = await POST(signRequest(ACK), ctx)
    expect(res.status).toBe(404)
  })

  it('eşzamanlı çift imza — updateMany count=0 → 409', async () => {
    prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 0 })
    const res = await POST(signRequest(ACK), ctx)
    expect(res.status).toBe(409)
  })
})
