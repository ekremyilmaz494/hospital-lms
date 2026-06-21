import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    examAttempt: { findFirst: vi.fn() },
    trainingAssignment: { findFirst: vi.fn() },
    trainingFeedbackResponse: { findFirst: vi.fn() },
  },
}))

import { verifyEvent } from '../verify'
import { prisma } from '@/lib/prisma'

const mockAttempt = vi.mocked(prisma.examAttempt.findFirst)
const mockAssignment = vi.mocked(prisma.trainingAssignment.findFirst)
const mockFeedback = vi.mocked(prisma.trainingFeedbackResponse.findFirst)

const REF = 'ref-1'
const USER = 'user-1'
const ORG = 'org-1'

describe('verifyEvent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exam_pass: isPassed + refId + userId cross-check, trainingId döner', async () => {
    mockAttempt.mockResolvedValue({ trainingId: 't1' } as never)
    const res = await verifyEvent('exam_pass', REF, USER, ORG)
    expect(res).toEqual({ verified: true, trainingId: 't1' })
    expect(mockAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: REF, userId: USER, organizationId: ORG, isPassed: true }),
      }),
    )
  })

  it('exam_pass: kayıt yoksa (başka kullanıcı / geçmemiş) doğrulanmaz', async () => {
    mockAttempt.mockResolvedValue(null as never)
    expect(await verifyEvent('exam_pass', REF, USER, ORG)).toEqual({ verified: false, trainingId: null })
  })

  it('training_complete: passed/completed statü + cross-check', async () => {
    mockAssignment.mockResolvedValue({ trainingId: 't2' } as never)
    const res = await verifyEvent('training_complete', REF, USER, ORG)
    expect(res).toEqual({ verified: true, trainingId: 't2' })
    const where = mockAssignment.mock.calls[0][0]?.where as Record<string, unknown>
    expect(where).toMatchObject({ id: REF, userId: USER, organizationId: ORG })
    expect(where.status).toEqual({ in: ['passed', 'completed'] })
  })

  it('feedback_submit: sahiplik bağlı ATTEMPT üzerinden (anonim feedback dahil)', async () => {
    mockFeedback.mockResolvedValue({ trainingId: 't3' } as never)
    const res = await verifyEvent('feedback_submit', REF, USER, ORG)
    expect(res).toEqual({ verified: true, trainingId: 't3' })
    expect(mockFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: REF, organizationId: ORG, attempt: { userId: USER } }),
      }),
    )
  })
})
