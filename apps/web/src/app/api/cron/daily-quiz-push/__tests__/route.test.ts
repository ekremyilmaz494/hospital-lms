import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/lib/expo-push', () => ({ sendExpoPushToMany: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    examAttempt: { findMany: vi.fn() },
    question: { findMany: vi.fn() },
    dailyReview: { createMany: vi.fn(), findMany: vi.fn() },
  },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { sendExpoPushToMany } from '@/lib/expo-push'

const mockAttemptFindMany = vi.mocked(prisma.examAttempt.findMany)
const mockQuestionFindMany = vi.mocked(prisma.question.findMany)
const mockReviewCreateMany = vi.mocked(prisma.dailyReview.createMany)
const mockReviewFindMany = vi.mocked(prisma.dailyReview.findMany)
const mockSendPush = vi.mocked(sendExpoPushToMany)

const OLD_SECRET = process.env.CRON_SECRET

function req(secret?: string) {
  return new Request('http://localhost/api/cron/daily-quiz-push', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('GET /api/cron/daily-quiz-push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })
  afterAll(() => {
    process.env.CRON_SECRET = OLD_SECRET
  })

  it('CRON_SECRET yanlışsa 401 ve hiçbir iş yapılmaz', async () => {
    const res = await GET(req('wrong'))
    expect(res.status).toBe(401)
    expect(mockAttemptFindMany).not.toHaveBeenCalled()
  })

  it('geçilen eğitimlerin sorularını seed eder ve due personele push atar', async () => {
    mockAttemptFindMany.mockResolvedValue([
      { userId: 'u1', trainingId: 't1', organizationId: 'org-1' },
    ] as never)
    mockQuestionFindMany.mockResolvedValue([
      { id: 'q1', trainingId: 't1' },
      { id: 'q2', trainingId: 't1' },
    ] as never)
    mockReviewCreateMany.mockResolvedValue({ count: 2 } as never)
    mockReviewFindMany.mockResolvedValue([{ userId: 'u1' }] as never)

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.seeded).toBe(2)
    expect(data.pushed).toBe(1)
    // skipDuplicates ile seed → mevcut box ezilmez.
    expect(mockReviewCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )
    // Deep-link data.url = /daily-quiz
    expect(mockSendPush).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ url: '/daily-quiz' }),
    )
  })

  it('geçilmiş eğitim yoksa seed atlanır, push 0', async () => {
    mockAttemptFindMany.mockResolvedValue([] as never)
    mockReviewFindMany.mockResolvedValue([] as never)

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.seeded).toBe(0)
    expect(data.pushed).toBe(0)
    expect(mockReviewCreateMany).not.toHaveBeenCalled()
    expect(mockSendPush).not.toHaveBeenCalled()
  })
})
