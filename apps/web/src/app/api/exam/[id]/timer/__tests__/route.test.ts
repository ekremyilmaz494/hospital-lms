import { describe, it, expect, vi, beforeEach } from 'vitest'
// Ortak personel (Faz 2.4): getStaffOrgIds tek-org döndürsün → myOrgs=[A], davranış eski tekil-org ile birebir.
vi.mock('@/lib/staff-orgs', () => ({ getStaffOrgIds: vi.fn(async (_userId, primaryOrgId) => [primaryOrgId]) }))

/**
 * timer/route.ts regresyon koruması — `autoCompleteExpiredAttempt` (Y7 bulgusu).
 *
 * Kilitlenen davranışlar:
 *   1. Atomiklik — attempt kapanışı (updateMany) + assignment durumu (update)
 *      TEK $transaction içinde. Biri çökerse tutarsız durum kalmaz.
 *   2. State machine tutarlılığı — assignment durumu elle değil
 *      `assignmentNextStatus(..., { type: 'POST_EXAM_FAILED' })` ile türetilir.
 *      Hak kalmadıysa (currentAttempt >= maxAttempts) → 'failed';
 *      kaldıysa → 'in_progress'. Davranış eski elle-hesaplamayla birebir aynı.
 *   3. Atomik guard — updateMany count=0 ise (yarış kaybedildi) assignment
 *      güncellemesi yapılmaz.
 *   4. Assignment terminal'deyse — SM ok:false döner → assignment güncellemesi
 *      atlanır, attempt kapanışı yine de geçerli kalır (throw yok).
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttempt: { findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    trainingAssignment: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/redis', () => ({
  startExamTimer: vi.fn().mockResolvedValue(Date.now() + 60_000),
  resumeExamTimer: vi.fn().mockResolvedValue(undefined),
  getExamTimeRemaining: vi.fn().mockResolvedValue(null),
  isExamExpired: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
  }) => Promise<Response>) => {
    return async (_request: Request, { params }: { params: Promise<P> }) => handler({
      params: await params,
      dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
      organizationId: 'org-1',
    })
  },
}))

import { GET, POST } from '../route'
import { logger } from '@/lib/logger'
import { getExamTimeRemaining, isExamExpired, resumeExamTimer } from '@/lib/redis'
import { assignmentNextStatus, type AssignmentStatus } from '@/lib/exam-state-machine'

const loggerWarn = vi.mocked(logger.warn)
const redisResume = vi.mocked(resumeExamTimer)
const redisRemaining = vi.mocked(getExamTimeRemaining)
const redisExpired = vi.mocked(isExamExpired)

/** Süresi dolmuş post_exam attempt — phaseStartedAt geçmişte, training süresi 30dk. */
function expiredAttempt(overrides: {
  attemptStatus?: string
  assignmentStatus?: string
  currentAttempt?: number
  maxAttempts?: number
} = {}) {
  const longAgo = new Date(Date.now() - 60 * 60 * 1000) // 1 saat önce
  return {
    id: 'att-1',
    userId: 'staff-1',
    status: overrides.attemptStatus ?? 'post_exam',
    assignmentId: 'asg-1',
    preExamStartedAt: null,
    postExamStartedAt: longAgo,
    training: { organizationId: 'org-1', examDurationMinutes: 30 },
    assignment: {
      status: overrides.assignmentStatus ?? 'in_progress',
      currentAttempt: overrides.currentAttempt ?? 1,
      maxAttempts: overrides.maxAttempts ?? 3,
    },
  }
}

const ctx = { params: Promise.resolve({ id: 'att-1' }) }
const req = new Request('http://localhost/api/exam/att-1/timer')

beforeEach(() => {
  vi.clearAllMocks()
  // Redis yok → DB recovery yoluna düşer; expired hesaplanır.
  redisRemaining.mockResolvedValue(null)
  redisExpired.mockResolvedValue(false)
  prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.trainingAssignment.update.mockResolvedValue({})
  // $transaction: callback'i prismaMock'u tx olarak vererek çalıştır.
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock),
  )
})

describe('autoCompleteExpiredAttempt — atomiklik + state machine tutarlılığı', () => {
  it('attempt kapanışı + assignment güncellemesi TEK $transaction içinde', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(expiredAttempt())

    const res = await GET(req, ctx)
    expect(res.status).toBe(200)

    // updateMany + trainingAssignment.update tek transaction içinde çalıştı.
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledOnce()
    expect(prismaMock.trainingAssignment.update).toHaveBeenCalledOnce()

    // Atomik guard korundu: updateMany where'inde status filtresi var.
    const updateArgs = prismaMock.examAttempt.updateMany.mock.calls[0][0] as {
      where: { status: { in: string[] } }; data: Record<string, unknown>
    }
    expect(updateArgs.where.status.in).toEqual(['pre_exam', 'post_exam'])
    expect(updateArgs.data.status).toBe('completed')
    expect(updateArgs.data.isPassed).toBe(false)
  })

  it('hak kaldıysa (currentAttempt < maxAttempts) → assignment in_progress', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      expiredAttempt({ currentAttempt: 1, maxAttempts: 3 }),
    )

    await GET(req, ctx)

    const args = prismaMock.trainingAssignment.update.mock.calls[0][0] as {
      where: Record<string, unknown>; data: { status: string }
    }
    expect(args.data.status).toBe('in_progress')
  })

  it('hak kalmadıysa (currentAttempt >= maxAttempts) → assignment failed', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      expiredAttempt({ currentAttempt: 3, maxAttempts: 3 }),
    )

    await GET(req, ctx)

    const args = prismaMock.trainingAssignment.update.mock.calls[0][0] as {
      where: Record<string, unknown>; data: { status: string }
    }
    expect(args.data.status).toBe('failed')
  })

  it('türetilen assignment durumu state machine ile birebir tutarlı', async () => {
    // Eski elle-hesap: currentAttempt >= maxAttempts ? 'failed' : 'in_progress'.
    // attemptsRemaining = currentAttempt >= maxAttempts ? 0 : maxAttempts - currentAttempt.
    const cases: Array<{ currentAttempt: number; maxAttempts: number }> = [
      { currentAttempt: 1, maxAttempts: 3 },
      { currentAttempt: 2, maxAttempts: 3 },
      { currentAttempt: 3, maxAttempts: 3 },
      { currentAttempt: 5, maxAttempts: 3 },
    ]
    for (const c of cases) {
      const legacy = c.currentAttempt >= c.maxAttempts ? 'failed' : 'in_progress'
      const attemptsRemaining =
        c.currentAttempt >= c.maxAttempts ? 0 : c.maxAttempts - c.currentAttempt
      const sm = assignmentNextStatus('in_progress', {
        type: 'POST_EXAM_FAILED',
        attemptsRemaining,
      })
      expect(sm.ok).toBe(true)
      if (sm.ok) expect(sm.next).toBe(legacy)
    }
  })

  it('updateMany count=0 (yarış kaybedildi) → assignment güncellenmez', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(expiredAttempt())
    prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 0 })

    const res = await GET(req, ctx)
    expect(res.status).toBe(200)

    // Transaction çalıştı ama içinde erken çıkıldı — assignment update YOK.
    expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledOnce()
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('assignment zaten terminal (passed) → SM ok:false → güncelleme atlanır, throw yok', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      expiredAttempt({ assignmentStatus: 'passed' }),
    )

    const res = await GET(req, ctx)
    expect(res.status).toBe(200)

    // Attempt kapanışı yine de yapıldı (geçerli kalır).
    expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledOnce()
    // Assignment terminal → güncelleme atlandı + warn loglandı.
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('attempt pre/post_exam değilse (bulunamaz) → hiçbir yazma yapılmaz', async () => {
    // findFirst where'i status: { in: ['pre_exam','post_exam'] } filtreler.
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)
    // Süresi dolmuş gibi görünmesini engelle — DB recovery expired hesaplamasın.
    redisExpired.mockResolvedValue(false)

    const res = await GET(req, ctx)
    expect(res.status).toBe(404) // GET ownership check'i de attempt bulamaz

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('assignmentNextStatus POST_EXAM_FAILED — non-in_progress için ok:false döner', () => {
    // Doğrudan SM kontratını da kilitle: terminal/assigned durumda transition reddedilir.
    const terminals: AssignmentStatus[] = ['passed', 'failed', 'locked', 'assigned']
    for (const s of terminals) {
      const r = assignmentNextStatus(s, { type: 'POST_EXAM_FAILED', attemptsRemaining: 1 })
      expect(r.ok).toBe(false)
    }
  })
})

/**
 * POST handler — son sınav saatinin LAZY başlangıcı (İZEM CAN incident, 2026-06-03).
 * postExamStartedAt artık video bitiminde değil, personel son sınava fiilen girince
 * (bu POST mount'ta çağrılınca) damgalanır.
 */
function postAttempt(overrides: { status?: string; postExamStartedAt?: Date | null; preExamStartedAt?: Date | null } = {}) {
  return {
    id: 'att-1',
    userId: 'staff-1',
    status: overrides.status ?? 'post_exam',
    assignmentId: 'asg-1',
    preExamStartedAt: overrides.preExamStartedAt ?? null,
    postExamStartedAt: overrides.postExamStartedAt ?? null,
    training: { organizationId: 'org-1', examDurationMinutes: 30 },
  }
}

const postReq = new Request('http://localhost/api/exam/att-1/timer', { method: 'POST' })

describe('POST timer — postExamStartedAt lazy stamp', () => {
  it('post_exam + postExamStartedAt null → atomik guard ile stamp + taze süre', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(postAttempt({ postExamStartedAt: null }))
    prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(postReq, ctx)
    expect(res.status).toBe(200)

    expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledOnce()
    const args = prismaMock.examAttempt.updateMany.mock.calls[0][0] as {
      where: { id: string; status: string; postExamStartedAt: null }
      data: { postExamStartedAt: Date }
    }
    expect(args.where.id).toBe('att-1')
    expect(args.where.status).toBe('post_exam')
    expect(args.where.postExamStartedAt).toBeNull()
    expect(args.data.postExamStartedAt).toBeInstanceOf(Date)

    expect(redisResume).toHaveBeenCalledOnce()
    const body = (await res.json()) as { remainingSeconds: number; expired: boolean }
    expect(body.expired).toBe(false)
    expect(body.remainingSeconds).toBeGreaterThan(1790)
  })

  it('postExamStartedAt zaten dolu → ikinci stamp YOK (idempotent)', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    prismaMock.examAttempt.findFirst.mockResolvedValue(postAttempt({ postExamStartedAt: fiveMinAgo }))

    const res = await POST(postReq, ctx)
    expect(res.status).toBe(200)

    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    expect(redisResume).toHaveBeenCalledOnce()
    const body = (await res.json()) as { expired: boolean }
    expect(body.expired).toBe(false)
  })

  it('pre_exam fazı → postExamStartedAt stamp EDİLMEZ', async () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000)
    prismaMock.examAttempt.findFirst.mockResolvedValue(
      postAttempt({ status: 'pre_exam', preExamStartedAt: oneMinAgo, postExamStartedAt: null }),
    )

    const res = await POST(postReq, ctx)
    expect(res.status).toBe(200)
    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
  })
})
