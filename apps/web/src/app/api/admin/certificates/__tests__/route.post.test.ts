import { describe, it, expect, vi, beforeEach } from 'vitest'

// withAdminRoute'u sarmadan handler'ı çağır — org context'i enjekte et.
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: {
      request: Request
      organizationId: string
      audit: (p: unknown) => Promise<void>
    }) => Promise<Response>,
  ) => {
    return async (request: Request) =>
      handler({ request, organizationId: 'org-1', audit: vi.fn().mockResolvedValue(undefined) })
  },
}))

const userFindFirst = vi.fn()
const trainingFindFirst = vi.fn()
const attemptFindFirst = vi.fn()
const certCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    training: { findFirst: (...a: unknown[]) => trainingFindFirst(...a) },
    examAttempt: { findFirst: (...a: unknown[]) => attemptFindFirst(...a) },
    certificate: { findMany: vi.fn(), create: (...a: unknown[]) => certCreate(...a) },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Kod üretimi ayrı (certificate-helpers) test edilir — burada deterministik mock.
const FIXED_CODE = 'CERT-' + 'A'.repeat(32)
vi.mock('@/lib/certificate-helpers', () => ({
  generateCertificateCode: () => FIXED_CODE,
}))

import { POST } from '../route'

const U = '11111111-1111-4111-8111-111111111111'
const T = '22222222-2222-4222-8222-222222222222'
const A = '33333333-3333-4333-8333-333333333333'

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/certificates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/certificates (manuel sertifika)', () => {
  beforeEach(() => {
    userFindFirst.mockReset()
    trainingFindFirst.mockReset()
    attemptFindFirst.mockReset()
    certCreate.mockReset()
  })

  it('eksik alanda zod reddi → 400 (DB çağrısı yok)', async () => {
    const res = await POST(postReq({ userId: U, trainingId: T }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeTruthy()
    expect(userFindFirst).not.toHaveBeenCalled()
  })

  it('geçersiz uuid → 400', async () => {
    const res = await POST(postReq({ userId: 'not-a-uuid', trainingId: T, attemptId: A }) as never)
    expect(res.status).toBe(400)
  })

  it('başarısız deneme için → 409', async () => {
    userFindFirst.mockResolvedValue({ id: U })
    trainingFindFirst.mockResolvedValue({ id: T })
    attemptFindFirst.mockResolvedValue({ id: A, userId: U, trainingId: T, isPassed: false, assignment: { periodId: null } })

    const res = await POST(postReq({ userId: U, trainingId: T, attemptId: A }) as never)
    expect(res.status).toBe(409)
    expect(certCreate).not.toHaveBeenCalled()
  })

  it('geçerli istek → 201 + kriptografik kod', async () => {
    userFindFirst.mockResolvedValue({ id: U })
    trainingFindFirst.mockResolvedValue({ id: T })
    attemptFindFirst.mockResolvedValue({ id: A, userId: U, trainingId: T, isPassed: true, assignment: { periodId: 'period-1' } })
    certCreate.mockResolvedValue({ id: 'cert-1', certificateCode: FIXED_CODE })

    const res = await POST(postReq({ userId: U, trainingId: T, attemptId: A }) as never)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.certificateCode).toMatch(/^CERT-[0-9A-F]{32}$/)
    // organizationId + periodId tenant/dönem izolasyonu için yazılmalı
    expect(certCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1', periodId: 'period-1', certificateCode: FIXED_CODE }),
      }),
    )
  })
})
