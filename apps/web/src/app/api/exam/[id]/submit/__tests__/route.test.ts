import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * submit/route.ts regresyon koruması (Plan: birden-fazla-agentla... Faz 3).
 *
 * Kilitlenen davranışlar:
 *   1. Skor hesabı — doğru/yanlış cevap sayımı, geçti/kaldı eşiği.
 *   2. Idempotency — tamamlanmış deneme yeniden submit edilirse 400 değil
 *      KAYITLI sonuç döner (çift tıklama / retry / ağ tekrarı).
 *   3. Atomiklik — skor + cevap + assignment yazımı tek $transaction'da;
 *      CAS (status-filtreli updateMany) ilk adım, yarış kaybedilirse yazma yok.
 *   4. Anti-cheat — başarısız denemede soru detayları (results) dönülmez.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttempt: { findFirst: vi.fn(), updateMany: vi.fn() },
    question: { findMany: vi.fn() },
    examAnswer: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    trainingAssignment: { update: vi.fn() },
    notification: { create: vi.fn() },
    smgCategory: { findFirst: vi.fn() },
    smgActivity: { upsert: vi.fn() },
    trainingFeedbackForm: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  clearExamTimer: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/dashboard-cache', () => ({ invalidateDashboardCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/feedback-helpers', () => ({ isAttemptFeedbackTriggered: vi.fn().mockReturnValue(false) }))
vi.mock('@/lib/certificate-helpers', () => ({ issueCertificateForAttempt: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/exam-helpers', () => ({
  // Passthrough — subset/shuffle bu testin konusu değil.
  getEffectiveExamQuestions: vi.fn((qs: unknown[]) => qs),
  advancePastVideosIfNoneRequired: vi.fn().mockResolvedValue({ advanced: false, status: 'watching_videos' }),
}))
vi.mock('@/lib/validations', () => ({
  // Passthrough validation — test body'yi doğrudan kontrol eder.
  submitExamSchema: { safeParse: (b: unknown) => ({ success: true, data: b }) },
}))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => { try { return await req.json() } catch { return null } },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string; email: string; firstName: string; lastName: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => handler({
      request,
      params: await params,
      dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1', email: 's@x.com', firstName: 'Ay', lastName: 'Yz' },
      organizationId: 'org-1',
      audit: vi.fn().mockResolvedValue(undefined),
    })
  },
}))

import { POST } from '../route'

const QUESTIONS = [
  {
    id: 'q1', points: 10, sortOrder: 0, questionText: 'Soru 1',
    options: [
      { id: 'q1a', optionText: 'Doğru', isCorrect: true, sortOrder: 0 },
      { id: 'q1b', optionText: 'Yanlış', isCorrect: false, sortOrder: 1 },
    ],
  },
  {
    id: 'q2', points: 10, sortOrder: 1, questionText: 'Soru 2',
    options: [
      { id: 'q2a', optionText: 'Doğru', isCorrect: true, sortOrder: 0 },
      { id: 'q2b', optionText: 'Yanlış', isCorrect: false, sortOrder: 1 },
    ],
  },
]

function baseTraining(overrides: Record<string, unknown> = {}) {
  return {
    passingScore: 70, examDurationMinutes: 30, maxAttempts: 3, title: 'İSG Eğitimi',
    smgPoints: 0, renewalPeriodMonths: null, organizationId: 'org-1',
    examOnly: false, randomizeQuestions: false, randomQuestionCount: null,
    organization: { name: 'Org' }, ...overrides,
  }
}

function baseAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1', userId: 'staff-1', trainingId: 'tr-1', assignmentId: 'asg-1',
    attemptNumber: 1, status: 'post_exam',
    preExamStartedAt: null, postExamStartedAt: new Date(),
    preExamScore: 50, postExamScore: null, isPassed: null,
    training: baseTraining(),
    assignment: { id: 'asg-1', maxAttempts: 3, status: 'in_progress', periodId: null, originalMaxAttempts: 3 },
    ...overrides,
  }
}

function submitRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/exam/att-1/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const ctx = { params: Promise.resolve({ id: 'att-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.question.findMany.mockResolvedValue(QUESTIONS)
  prismaMock.examAnswer.findMany.mockResolvedValue([])
  prismaMock.examAnswer.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.examAnswer.createMany.mockResolvedValue({ count: 0 })
  prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.trainingAssignment.update.mockResolvedValue({})
  prismaMock.notification.create.mockResolvedValue({})
  prismaMock.trainingFeedbackForm.findFirst.mockResolvedValue(null)
  // $transaction: callback'i prismaMock'u tx olarak vererek çalıştır.
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock))
})

describe('POST /api/exam/[id]/submit', () => {
  it('post-exam GEÇTİ — skor doğru hesaplanır, transaction çalışır', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(baseAttempt())
    // Post fazda cevaplar examAnswer kayıtlarından okunur (body değil).
    prismaMock.examAnswer.findMany.mockResolvedValue([
      { questionId: 'q1', selectedOptionId: 'q1a' },
      { questionId: 'q2', selectedOptionId: 'q2a' },
    ])

    const res = await POST(submitRequest({ phase: 'post' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score).toBe(100)
    expect(body.isPassed).toBe(true)
    expect(body.results).toHaveLength(2) // geçen kullanıcıya döküm verilir

    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    const updateArgs = prismaMock.examAttempt.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>; data: Record<string, unknown>
    }
    expect(updateArgs.where.status).toBe('post_exam') // CAS guard
    expect(updateArgs.data.postExamScore).toBe(100)
    expect(updateArgs.data.isPassed).toBe(true)
    expect(updateArgs.data.status).toBe('completed')
  })

  it('post-exam KALDI — başarısız denemede results dönülmez (anti-cheat)', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(baseAttempt())
    prismaMock.examAnswer.findMany.mockResolvedValue([
      { questionId: 'q1', selectedOptionId: 'q1b' },
      { questionId: 'q2', selectedOptionId: 'q2b' },
    ])

    const res = await POST(submitRequest({ phase: 'post' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score).toBe(0)
    expect(body.isPassed).toBe(false)
    expect(body.results).toBeUndefined()
  })

  it('çift submit — tamamlanmış deneme 400 yerine KAYITLI sonucu döner (idempotency)', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      baseAttempt({ status: 'completed', postExamScore: 88, isPassed: true }),
    )

    const res = await POST(submitRequest({ phase: 'post' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score).toBe(88)
    expect(body.isPassed).toBe(true)
    // Yeniden skorlama YOK — transaction da updateMany da çağrılmamalı.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
  })

  it('yarış — updateMany count=0 ise yazma yapılmaz, idempotent yanıt döner', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(baseAttempt({ postExamScore: 90, isPassed: true }))
    prismaMock.examAnswer.findMany.mockResolvedValue([{ questionId: 'q1', selectedOptionId: 'q1a' }])
    prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 0 }) // yarış kaybedildi

    const res = await POST(submitRequest({ phase: 'post' }), ctx)
    expect(res.status).toBe(200)
    // CAS yarışı kaybedildi → cevap yazımı YAPILMAMALI.
    expect(prismaMock.examAnswer.createMany).not.toHaveBeenCalled()
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('pre-exam submit — skor yazılır, nextStep videos', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      baseAttempt({ status: 'pre_exam', preExamStartedAt: new Date(), postExamStartedAt: null, preExamScore: null }),
    )

    const res = await POST(
      submitRequest({
        phase: 'pre',
        answers: [
          { questionId: 'q1', selectedOptionId: 'q1a' },
          { questionId: 'q2', selectedOptionId: 'q2a' },
        ],
      }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.phase).toBe('pre')
    expect(body.score).toBe(100)
    expect(body.nextStep).toBe('videos')

    const updateArgs = prismaMock.examAttempt.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>; data: Record<string, unknown>
    }
    expect(updateArgs.where.status).toBe('pre_exam')
    expect(updateArgs.data.status).toBe('watching_videos')
  })
})
