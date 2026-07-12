import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Bu test dosyası şu regresyonları kilitler:
 *
 *   1. POST /api/exam/[id]/start — kullanıcının assignment'ında sadece terminal
 *      (completed/expired) attempt varsa rota YENİ attempt yaratmalı, eskiyi
 *      resume ETMEMELİ. Aksi halde frontend `attemptStatus='expired'` görüp
 *      `attemptPhaseRedirect` ile detay sayfasına atılır, kullanıcı "Videoları
 *      İzle"ye basıp tekrar buraya gelir → sonsuz döngü. (2026-05-20 Devakent
 *      ÖZGÜR ÜNVER incident.)
 *
 *   2. TEK KARAR YOLU (Haziran 2026 kök neden çözümü): resume/promote mantığı
 *      YALNIZ transaction içinde yaşar; tx içi double-check filtresi
 *      `notIn: ['completed', 'expired']` olmalı. Eskiden aynı blok transaction
 *      dışında da kopyalanmıştı ve iki kopyanın filtreleri ayrışınca sonsuz
 *      döngü doğuyordu (commit 2fa15b1). Dışarıda yalnız resolver'la "rate
 *      limit gerekli mi?" okuması kalır — resume rate limit'e takılmaz.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    examAttempt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/feedback-helpers', () => ({
  getPendingMandatoryFeedback: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/training-helpers', () => ({
  isTrainingAccessible: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/exam-helpers', () => ({
  advancePastVideosIfNoneRequired: vi.fn().mockResolvedValue({
    advanced: false,
    status: 'watching_videos',
  }),
}))

// Route rate-limit kararını resolver'la verir; resolver davranışının kendisi
// exam-flow-resolver.test.ts'te kilitli — burada birim sınırı olarak mock'lanır.
vi.mock('@/lib/exam-flow-resolver', () => ({
  resolveExamFlowState: vi.fn(),
}))

vi.mock('@/lib/date-helpers', () => ({
  isEndDatePassed: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        request,
        params: await params,
        dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { POST } from '../route'
import { resolveExamFlowState } from '@/lib/exam-flow-resolver'
import { checkRateLimit } from '@/lib/redis'

/** Resolver mock'u: activeAttempt verilirse resume yolu (rate limit atlanır). */
function mockFlow(activeAttempt: Record<string, unknown> | null) {
  vi.mocked(resolveExamFlowState).mockResolvedValue({
    assignment: {
      id: 'assignment-1',
      trainingId: 'training-1',
      organizationId: 'org-1',
      status: 'in_progress',
      currentAttempt: 1,
      maxAttempts: 3,
      round: 1,
      dueDate: null,
    },
    attempt: activeAttempt,
    activeAttempt,
    stage: ((activeAttempt?.status as string) ?? 'none') as never,
    requiredVideoCount: 1,
    noRequiredVideos: false,
    redirect: null,
  } as Awaited<ReturnType<typeof resolveExamFlowState>>)
}

function startRequest(): Request {
  return new Request('http://localhost/api/exam/assignment-1/start', {
    method: 'POST',
  })
}

const ASSIGNMENT_ID = 'assignment-1'
const TRAINING_ID = 'training-1'
const ORG_ID = 'org-1'
const USER_ID = 'staff-1'

const baseAssignment = {
  id: ASSIGNMENT_ID,
  trainingId: TRAINING_ID,
  status: 'in_progress' as const,
  currentAttempt: 1, // önceki attempt expired
  maxAttempts: 3,
  dueDate: null,
  training: {
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-12-31'),
    examOnly: false,
    requirePreExamOnRetry: false,
    title: 'RADYASYON GÜVENLİĞİ',
    isActive: true,
    publishStatus: 'published',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.trainingAssignment.findFirst.mockResolvedValue(baseAssignment)
  prismaMock.trainingAssignment.update.mockResolvedValue({})
})

/**
 * `prisma.$transaction(async (tx) => { ... })` mock'u — gelen callback'i bizim
 * verdiğimiz sahte tx ile çalıştırır. Test başına `txOverrides` parametresiyle
 * tx içindeki sorguların dönüş değerlerini özelleştirebiliriz.
 */
function mockTransaction(opts: {
  innerExistingAttempt: unknown | null
  createdAttempt?: Record<string, unknown>
}) {
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        examAttempt: {
          findFirst: vi.fn().mockResolvedValue(opts.innerExistingAttempt),
          create: vi.fn().mockResolvedValue(
            opts.createdAttempt ?? {
              id: 'new-attempt-id',
              attemptNumber: baseAssignment.currentAttempt + 1,
              status: 'watching_videos',
              trainingId: TRAINING_ID,
              userId: USER_ID,
              organizationId: ORG_ID,
              videoProgress: [],
            },
          ),
          update: vi.fn(),
        },
        trainingAssignment: {
          update: vi.fn().mockResolvedValue({}),
        },
      }
      return cb(tx)
    },
  )
}

describe('POST /api/exam/[id]/start — expired attempt resume engeli (KRİTİK)', () => {
  it('aktif attempt yoksa (sadece terminal var) yeni attempt akışına girer + rate limit uygulanır', async () => {
    // Resolver aktif attempt görmüyor → rate limit kontrolü yapılır, tx'e girilir.
    mockFlow(null)
    mockTransaction({ innerExistingAttempt: null })

    const res = await POST(startRequest(), {
      params: Promise.resolve({ id: ASSIGNMENT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('watching_videos')
    expect(body.attemptNumber).toBe(2)
    expect(checkRateLimit).toHaveBeenCalled()
    // Route attempt tespitini transaction DIŞINDA kendi sorgusuyla YAPMAMALI —
    // tek doğruluk kaynağı resolver (kopya sorgu = drift = 2fa15b1 sınıfı bug).
    expect(prismaMock.examAttempt.findFirst).not.toHaveBeenCalled()
  })

  it('transaction içi double-check expired attempt\'i resume ETMEMELİ — yeni attempt yarat', async () => {
    // Senaryo: önceki attempt expired (cron tarafından), DB'de duruyor.
    // Resolver da onu aktif saymaz → yeni attempt akışı.
    mockFlow(null)

    // Transaction içindeki double-check çalışacak. ESKI bug: `not: 'completed'`
    // filter expired'i de getirirdi. Bu test bug'ı saptamak için tx içinde
    // expired attempt varmış GİBİ kuruyor — DOĞRU fix uygulandıysa tx içi
    // findFirst NULL almalı (status filter expired'i de hariç tutar) ve route
    // create akışına gitmeli.

    // tx içi findFirst mock'unu özelleştir: expired attempt mevcut olsa BİLE
    // (DB'de var), tx içindeki where filter expired'i hariç tutuyorsa MOCK
    // null dönmeli. Burada CALL ARGS'ı kontrol ederek bunu doğruluyoruz.
    type InnerArgs = { where: { status?: { notIn?: readonly string[]; not?: string } } }
    const innerCalls: InnerArgs[] = []
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const innerFindFirst = vi.fn((args: InnerArgs) => {
          innerCalls.push(args)
          // Filter'ın expired'i hariç tuttuğunu kontrol et — eğer ediyorsa null dön
          if (args?.where?.status?.notIn?.includes('expired')) {
            return Promise.resolve(null)
          }
          // Eski buggy filter (`not: 'completed'`) → expired attempt'i dön
          return Promise.resolve({
            id: 'expired-attempt',
            attemptNumber: 1,
            status: 'expired',
            preExamCompletedAt: new Date(),
            videoProgress: [],
          })
        })

        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          examAttempt: {
            findFirst: innerFindFirst,
            create: vi.fn().mockResolvedValue({
              id: 'new-attempt-id',
              attemptNumber: 2,
              status: 'watching_videos',
              trainingId: TRAINING_ID,
              userId: USER_ID,
              organizationId: ORG_ID,
              videoProgress: [],
            }),
            update: vi.fn(),
          },
          trainingAssignment: {
            update: vi.fn().mockResolvedValue({}),
          },
        }
        return cb(tx)
      },
    )

    const res = await POST(startRequest(), {
      params: Promise.resolve({ id: ASSIGNMENT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()

    // KRİTİK assertion: yeni attempt yaratılmış olmalı, expired resume EDİLMEMELİ
    expect(body.status).toBe('watching_videos')
    expect(body.attemptNumber).toBe(2)
    expect(body.id).toBe('new-attempt-id')
    expect(body.id).not.toBe('expired-attempt')

    // Inner findFirst'ün status filter'ı outer ile AYNI olmalı
    expect(innerCalls.length).toBeGreaterThan(0)
    expect(innerCalls[0].where.status?.notIn).toEqual(['completed', 'expired'])
  })

  it('aktif (non-terminal) attempt varsa tx içinde resume edilir ve rate limit ATLANIR', async () => {
    // TEK YOL mimarisi: resume da transaction içinden geçer (SELECT FOR UPDATE
    // ile yarış güvenli) — ama resolver aktif attempt gördüğü için rate limit
    // kontrolü hiç yapılmaz (resume rate limit'e takılmamalı).
    const activeAttempt = {
      id: 'active-attempt',
      attemptNumber: 1,
      status: 'watching_videos',
      preExamCompletedAt: new Date(),
      trainingId: TRAINING_ID,
      videoProgress: [],
    }
    mockFlow(activeAttempt)
    mockTransaction({ innerExistingAttempt: activeAttempt })

    const res = await POST(startRequest(), {
      params: Promise.resolve({ id: ASSIGNMENT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('active-attempt')
    expect(body.status).toBe('watching_videos')

    // Resume rate limit'e takılmaz; karar tek yoldan (tx) geçer.
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })
})

describe('POST /api/exam/[id]/start — ön test FİİLEN tamamlanmadıysa retry atlanmaz (2026-06 düzeltme)', () => {
  // tx mock'u create çağrısının data'sını yakalar; create dönüşü GERÇEK status'ü yansıtır
  // (hardcoded değil) ki initialStatus hesabı doğrulanabilsin. findFirst sırayla:
  // 1) existingInTx (resume kontrolü), 2) priorPreExam (ön test fiilen tamamlandı mı).
  function txCapture(opts: { existingInTx: unknown; priorPreExam: unknown }) {
    const create = vi.fn().mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-attempt-id',
        attemptNumber: data.attemptNumber,
        status: data.status,
        preExamScore: data.preExamScore ?? null,
        trainingId: TRAINING_ID,
        userId: USER_ID,
        organizationId: ORG_ID,
        videoProgress: [],
      }),
    )
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const findFirst = vi
          .fn()
          .mockResolvedValueOnce(opts.existingInTx)
          .mockResolvedValue(opts.priorPreExam)
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          examAttempt: { findFirst, create, update: vi.fn() },
          trainingAssignment: { update: vi.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      },
    )
    return create
  }

  it("ön testi hiç tamamlamamış retry → yeni attempt pre_exam'da yaratılır (videoya atlanmaz)", async () => {
    // İlk denemesi ön testteyken expire/timeout olan personel: önceki gerçek tamamlanma YOK.
    mockFlow(null)
    const create = txCapture({ existingInTx: null, priorPreExam: null })

    const res = await POST(startRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    expect(res.status).toBe(200)

    expect(create).toHaveBeenCalledTimes(1)
    const data = (create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data.status).toBe('pre_exam') // KRİTİK: ön test baştan istenir
    expect(data.preExamStartedAt).toBeInstanceOf(Date)
    expect(data.preExamCompletedAt).toBeUndefined() // sahte tamamlanma damgası YOK
    expect(data.preExamScore).toBeUndefined() // sahte 0 puan YOK
  })

  it("ön testi gerçekten tamamlamış retry → watching_videos'ta yaratılır, gerçek puan taşınır (sahte 0 değil)", async () => {
    mockFlow(null)
    const create = txCapture({ existingInTx: null, priorPreExam: { preExamScore: 85 } })

    const res = await POST(startRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    expect(res.status).toBe(200)

    const data = (create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data.status).toBe('watching_videos') // genuine retry → ön test atlanır
    expect(data.preExamCompletedAt).toBeInstanceOf(Date)
    expect(data.preExamScore).toBe(85) // önceki GERÇEK puan taşındı, sahte 0 değil
  })
})
