import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper module-scope'ta prisma + email import eder; ikisi de mock'lanmalı.
const findUniqueMock = vi.fn()
const createMock = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}))

const certificateIssuedEmailMock = vi.fn()
vi.mock('@/lib/email', () => ({
  certificateIssuedEmail: (...args: unknown[]) => certificateIssuedEmailMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { issueCertificateForAttempt } from '../certificate-helpers'

const baseInput = {
  attemptId: 'attempt-1',
  userId: 'user-1',
  trainingId: 'training-1',
  organizationId: 'org-1',
  trainingTitle: 'İSG Temel Eğitimi',
  renewalPeriodMonths: 12,
  recipientEmail: 'staff@devakent.com',
  recipientFullName: 'Personel Bir',
}

describe('issueCertificateForAttempt', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    createMock.mockReset()
    certificateIssuedEmailMock.mockReset()
    certificateIssuedEmailMock.mockResolvedValue(undefined)
  })

  it('var olan sertifika için yeni üretmez (idempotent)', async () => {
    findUniqueMock.mockResolvedValue({ id: 'existing-cert' })

    const result = await issueCertificateForAttempt(baseInput)

    expect(result).toEqual({ created: false })
    expect(createMock).not.toHaveBeenCalled()
    expect(certificateIssuedEmailMock).not.toHaveBeenCalled()
  })

  it('sertifika yoksa oluşturur, email gönderir, code üretir', async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: 'new-cert' })

    const result = await issueCertificateForAttempt(baseInput)

    expect(result.created).toBe(true)
    expect(result.code).toMatch(/^CERT-[A-F0-9]{32}$/)
    expect(createMock).toHaveBeenCalledTimes(1)
    const createArgs = createMock.mock.calls[0][0]
    expect(createArgs.data).toMatchObject({
      userId: 'user-1',
      trainingId: 'training-1',
      attemptId: 'attempt-1',
      organizationId: 'org-1',
      certificateCode: result.code,
    })
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date)
    // Email fire-and-forget — beklemeden bir sonraki tick'te tetiklenir.
    await new Promise(resolve => setImmediate(resolve))
    expect(certificateIssuedEmailMock).toHaveBeenCalledWith(
      'staff@devakent.com',
      'Personel Bir',
      'İSG Temel Eğitimi',
      result.code,
    )
  })

  it('renewalPeriodMonths=null ise expiresAt null', async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: 'new-cert' })

    await issueCertificateForAttempt({ ...baseInput, renewalPeriodMonths: null })

    expect(createMock.mock.calls[0][0].data.expiresAt).toBeNull()
  })

  it('paralel yarış (P2002) yutulur, throw etmez', async () => {
    findUniqueMock.mockResolvedValue(null)
    const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    createMock.mockRejectedValue(p2002)

    const result = await issueCertificateForAttempt(baseInput)

    expect(result).toEqual({ created: false })
    expect(certificateIssuedEmailMock).not.toHaveBeenCalled()
  })

  it('P2002 dışı Prisma hatası fırlatılır', async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockRejectedValue(new Error('connection lost'))

    await expect(issueCertificateForAttempt(baseInput)).rejects.toThrow('connection lost')
    expect(certificateIssuedEmailMock).not.toHaveBeenCalled()
  })

  it('email gönderim hatası ana akışı bozmaz (fire-and-forget)', async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: 'new-cert' })
    certificateIssuedEmailMock.mockRejectedValue(new Error('SES down'))

    const result = await issueCertificateForAttempt(baseInput)

    expect(result.created).toBe(true)
    // Bekleyen Promise'ı flush et — unhandled rejection olmamalı.
    await new Promise(resolve => setImmediate(resolve))
  })
})
