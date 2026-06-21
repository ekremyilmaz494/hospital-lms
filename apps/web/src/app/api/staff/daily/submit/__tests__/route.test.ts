import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers')
  return {
    ...actual,
    getAuthUser: vi.fn(),
    getAuthUserStrict: vi.fn(),
    requireRole: vi.fn(),
    checkWritePermission: vi.fn().mockResolvedValue(null),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    jsonResponse: vi.fn((data: unknown, status = 200, headers?: Record<string, string>) =>
      Response.json(data, { status, headers }),
    ),
    errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  }
})

vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
// Faz 2 yan etkileri ayrı test edilir — route testinde izole et.
vi.mock('@/lib/gamification/streak', () => ({ touchStreak: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/gamification/badges', () => ({ evaluateBadges: vi.fn().mockResolvedValue([]) }))

// tx === prismaMock'un kendisi → tx.dailyReview.update aynı mock'tur (TDZ yok).
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    dailySubmission: { findUnique: vi.fn(), create: vi.fn() },
    dailyReview: { findMany: vi.fn(), update: vi.fn() },
    questionOption: { findMany: vi.fn() },
    pointLedger: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  )
  return { prisma: prismaMock }
})

import { POST } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockRateLimit = vi.mocked(checkRateLimit)
const mockSubFindUnique = vi.mocked(prisma.dailySubmission.findUnique)
const mockSubCreate = vi.mocked(prisma.dailySubmission.create)
const mockReviewFindMany = vi.mocked(prisma.dailyReview.findMany)
const mockReviewUpdate = vi.mocked(prisma.dailyReview.update)
const mockOptFindMany = vi.mocked(prisma.questionOption.findMany)
const mockTransaction = vi.mocked(prisma.$transaction)

// RFC 9562 geçerli v4 UUID'ler (zod v4 .uuid() variant/version'ı denetler).
const SUB_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
const Q1 = '11111111-1111-4111-8111-111111111111'
const Q2 = '22222222-2222-4222-9222-222222222222'
const OPT_Q1_CORRECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OPT_Q2_CORRECT = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb'
const OPT_WRONG = 'cccccccc-cccc-4ccc-accc-cccccccccccc'

const staffUser = {
  user: { id: 'staff-1' },
  dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1', isActive: true },
  error: null,
} as never

function body(payload: unknown) {
  return new Request('http://localhost/api/staff/daily/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/staff/daily/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)
    mockRateLimit.mockResolvedValue(true)
    mockReviewUpdate.mockResolvedValue({} as never)
    mockSubCreate.mockResolvedValue({} as never)
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  })

  it('doğruluğu SUNUCUDA hesaplar: doğru→box+1, yanlış→box0, puanı verir', async () => {
    mockSubFindUnique.mockResolvedValue(null as never)
    mockReviewFindMany.mockResolvedValue([
      { questionId: Q1, box: 0 },
      { questionId: Q2, box: 2 },
    ] as never)
    mockOptFindMany.mockResolvedValue([
      { questionId: Q1, id: OPT_Q1_CORRECT },
      { questionId: Q2, id: OPT_Q2_CORRECT },
    ] as never)

    const res = await POST(
      body({
        submissionId: SUB_ID,
        answers: [
          { questionId: Q1, optionId: OPT_Q1_CORRECT }, // doğru
          { questionId: Q2, optionId: OPT_WRONG }, // yanlış
        ],
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.correctCount).toBe(1)
    expect(data.pointsAwarded).toBe(10)
    const r1 = data.results.find((r: { questionId: string }) => r.questionId === Q1)
    const r2 = data.results.find((r: { questionId: string }) => r.questionId === Q2)
    expect(r1).toMatchObject({ correct: true, newBox: 1 })
    expect(r2).toMatchObject({ correct: false, newBox: 0 })
    expect(mockReviewUpdate).toHaveBeenCalledTimes(2)
    expect(mockSubCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: SUB_ID,
          correctCount: 1,
          pointsAwarded: 10,
          organizationId: 'org-1',
        }),
      }),
    )
  })

  it('idempotent: aynı submissionId → snapshot döner, yeni kredi YOK', async () => {
    mockSubFindUnique.mockResolvedValue({
      correctCount: 3,
      pointsAwarded: 30,
      resultsJson: [{ questionId: Q1, correct: true, newBox: 1, nextReviewAt: '2026-06-22' }],
    } as never)

    const res = await POST(
      body({ submissionId: SUB_ID, answers: [{ questionId: Q1, optionId: OPT_Q1_CORRECT }] }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.correctCount).toBe(3)
    expect(data.pointsAwarded).toBe(30)
    expect(data.results).toHaveLength(1)
    expect(mockTransaction).not.toHaveBeenCalled() // transaction'a hiç girilmez
    expect(mockSubCreate).not.toHaveBeenCalled()
  })

  it('rate limit aşılırsa 429', async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(
      body({ submissionId: SUB_ID, answers: [{ questionId: Q1, optionId: OPT_Q1_CORRECT }] }),
    )
    expect(res.status).toBe(429)
  })

  it('geçersiz submissionId → 400', async () => {
    const res = await POST(
      body({ submissionId: 'not-a-uuid', answers: [{ questionId: Q1, optionId: OPT_Q1_CORRECT }] }),
    )
    expect(res.status).toBe(400)
  })

  it('havuzda olmayan soru işlenmez (anti-abuse)', async () => {
    mockSubFindUnique.mockResolvedValue(null as never)
    mockReviewFindMany.mockResolvedValue([] as never) // havuz boş
    mockOptFindMany.mockResolvedValue([] as never)

    const res = await POST(
      body({ submissionId: SUB_ID, answers: [{ questionId: Q1, optionId: OPT_Q1_CORRECT }] }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.correctCount).toBe(0)
    expect(data.results).toEqual([])
    expect(mockReviewUpdate).not.toHaveBeenCalled()
  })
})
