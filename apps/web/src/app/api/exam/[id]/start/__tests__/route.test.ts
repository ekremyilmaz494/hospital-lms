import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Bu test dosyası iki regresyonu kilitler:
 *
 *   1. POST /api/exam/[id]/start — kullanıcının assignment'ında sadece terminal
 *      (completed/expired) attempt varsa rota YENİ attempt yaratmalı, eskiyi
 *      resume ETMEMELİ. Aksi halde frontend `attemptStatus='expired'` görüp
 *      `attemptPhaseRedirect` ile detay sayfasına atılır, kullanıcı "Videoları
 *      İzle"ye basıp tekrar buraya gelir → sonsuz döngü. (2026-05-20 Devakent
 *      ÖZGÜR ÜNVER incident; PR #165 detay-redirect doğru, bu transaction
 *      double-check `not: 'completed'` filter'ı yüzünden expired attempt
 *      "existing" sayılıp resume ediliyordu.)
 *
 *   2. Outer check (transaction öncesi) ve inner double-check (transaction içi
 *      SELECT FOR UPDATE sonrası) AYNI status filter'ını kullanmalı: BOTH
 *      `notIn: ['completed', 'expired']`. Aksi halde outer geçer (yeni attempt
 *      akışı), inner expired'i yakalar (resume akışı) → çelişki.
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
  it('outer check: aktif attempt yoksa (sadece terminal var) yeni attempt akışına girer', async () => {
    // Outer findFirst (status notIn [completed, expired]) → null döner.
    // Yani aktif attempt yok, transaction'a girilmeli.
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)
    mockTransaction({ innerExistingAttempt: null })

    const res = await POST(startRequest(), {
      params: Promise.resolve({ id: ASSIGNMENT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('watching_videos')
    expect(body.attemptNumber).toBe(2)

    // Outer findFirst'ün status filter'ı kritik: expired hariç olmalı
    const outerCall = prismaMock.examAttempt.findFirst.mock.calls[0][0] as {
      where: { status?: { notIn?: readonly string[] } }
    }
    expect(outerCall.where.status?.notIn).toEqual(['completed', 'expired'])
  })

  it('transaction içi double-check expired attempt\'i resume ETMEMELİ — yeni attempt yarat', async () => {
    // Senaryo: önceki attempt expired (cron tarafından), DB'de duruyor.
    // Outer findFirst (notIn) onu görmez → null döner.
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)

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

  it('outer check aktif (non-terminal) attempt bulursa onu resume eder, transaction\'a girmez', async () => {
    // Aktif watching_videos attempt mevcut — direkt resume edilmeli
    prismaMock.examAttempt.findFirst.mockResolvedValue({
      id: 'active-attempt',
      attemptNumber: 1,
      status: 'watching_videos',
      preExamCompletedAt: new Date(),
      trainingId: TRAINING_ID,
      videoProgress: [],
    })

    const res = await POST(startRequest(), {
      params: Promise.resolve({ id: ASSIGNMENT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('active-attempt')
    expect(body.status).toBe('watching_videos')

    // Transaction'a girilmemeli
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
