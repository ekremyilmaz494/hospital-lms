import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Staff My-Trainings Detail — step completion + needsRetry sözleşmesi.
 *
 * **KÖK NEDEN** (2026-05-17 Devakent RADYASYON incident):
 * `latestAttempt.status === 'expired'` durumunda backend final `else` branch'ına
 * düşüyor → preExamCompleted/videosCompleted/postExamCompleted hepsi `true` →
 * frontend `allDone=true` → CTA gizleniyor → personel sınava devam edemiyor.
 *
 * Bu test serisi, `isExpiredRetryable` durumunun GERÇEK ilerlemeye göre flag
 * döndürdüğünü ve frontend'in retry/normal akışına doğru yönlendirildiğini
 * (needsRetry koşullu) doğrular.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: {
      findFirst: vi.fn(),
    },
    examAttempt: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // EY.FR.40 geri bildirim — route Promise.all içinde her zaman çağırır.
    // Base mock'lar null/[] döner → feedback.formActive=false (mevcut testler etkilenmez).
    trainingFeedbackForm: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    trainingFeedbackResponse: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/date-helpers', () => ({
  isEndDatePassed: vi.fn().mockReturnValue(false),
  toEndOfDayUTC: (d: Date | string) => new Date(d),
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))

vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    params: Promise<P>
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
  }) => Promise<Response>) => {
    return async (_request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        params: Promise.resolve(await params),
        dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
        organizationId: 'org-1',
      })
    }
  },
}))

import { GET } from '../route'

const ASSIGNMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function detailRequest(): Request {
  return new Request(`http://localhost/api/staff/my-trainings/${ASSIGNMENT_ID}`)
}

function makeAssignment(
  latestAttemptOverrides: Record<string, unknown> = {},
  extra: { feedbackMandatory?: boolean; originalMaxAttempts?: number } = {},
) {
  return {
    id: ASSIGNMENT_ID,
    userId: 'staff-1',
    status: 'in_progress',
    currentAttempt: 1,
    maxAttempts: 3,
    originalMaxAttempts: extra.originalMaxAttempts ?? 3,
    training: {
      id: 'training-1',
      title: 'Test Eğitim',
      description: '',
      category: 'test',
      passingScore: 70,
      examDurationMinutes: 30,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-20'),
      examOnly: false,
      feedbackMandatory: extra.feedbackMandatory ?? false,
      videos: [
        { id: 'video-1', title: 'Video 1', durationSeconds: 300, sortOrder: 0, contentType: 'video' },
      ],
    },
    examAttempts: [
      {
        attemptNumber: 1,
        status: 'expired',
        isPassed: false,
        preExamScore: null,
        postExamScore: 0,
        preExamCompletedAt: null,
        videosCompletedAt: null,
        postExamStartedAt: null,
        postExamCompletedAt: new Date('2026-05-17T03:24:44Z'),
        videoProgress: [],
        ...latestAttemptOverrides,
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Staff my-trainings detail — isExpiredRetryable regression (Devakent incident)', () => {
  it('expired + pre-exam yarıda → step flag\'leri TAMAM gösterMEZ (kullanıcı kilitli kalmaz)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment())

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    // KRİTİK: hepsi false olmalı — aksi halde frontend allDone=true → CTA gizlenir
    expect(body.preExamCompleted).toBe(false)
    expect(body.videosCompleted).toBe(false)
    expect(body.postExamCompleted).toBe(false)
    expect(body.isExpiredRetryable).toBe(true)
    // Pre-exam yapılmadıysa needsRetry FALSE — normal 3-step akış (Ön Sınava Başla CTA)
    expect(body.needsRetry).toBe(false)
  })

  it('expired + pre-exam DONE + video yarıda → preExam true, videos/post false, needsRetry true', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment({
      preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
      preExamScore: 70,
      videosCompletedAt: null,
      // bogus cron alanları yine var
      postExamCompletedAt: new Date('2026-05-17T03:24:44Z'),
      postExamScore: 0,
      postExamStartedAt: null,
      videoProgress: [{ videoId: 'video-1', isCompleted: false }],
    }))

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.preExamCompleted).toBe(true)
    expect(body.videosCompleted).toBe(false)
    // Bogus postExamCompletedAt dolu olsa bile postExamStartedAt=null → completed false
    expect(body.postExamCompleted).toBe(false)
    expect(body.isExpiredRetryable).toBe(true)
    // Pre-exam yapıldıysa needsRetry TRUE — 2-step retry akışı (Videoları İzle CTA)
    expect(body.needsRetry).toBe(true)
  })

  it('active watching_videos attempt (revive sonrası) → expected aktif flag\'ler', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment({
      status: 'watching_videos',
      preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
      preExamScore: 70,
      videosCompletedAt: null,
      postExamCompletedAt: null,
      postExamScore: null,
      postExamStartedAt: null,
      videoProgress: [{ videoId: 'video-1', isCompleted: false }],
    }))

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.preExamCompleted).toBe(true)
    expect(body.videosCompleted).toBe(false)
    expect(body.postExamCompleted).toBe(false)
    expect(body.isExpiredRetryable).toBe(false)
    expect(body.needsRetry).toBe(false)
  })

  it('postExamCompletedAt set + postExamStartedAt null (legacy bogus data) → postExamCompleted FALSE', async () => {
    // Defansif kontrol: yeni cron BUG-1 fix sonrası bu durum oluşmaz, ama eski
    // DB satırlarında hâlâ bogus completedAt var. Çift kontrol bu satırlarda da çalışmalı.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment({
      status: 'watching_videos',
      preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
      postExamStartedAt: null,
      postExamCompletedAt: new Date('2026-05-17T03:24:44Z'), // bogus cron yazımı
      postExamScore: 0,
      videoProgress: [{ videoId: 'video-1', isCompleted: true }],
      videosCompletedAt: new Date(),
    }))

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    // Bogus completedAt dolu ama startedAt null → completion sayılmaz
    expect(body.postExamCompleted).toBe(false)
  })
})

describe('Staff my-trainings detail — geri bildirim (EY.FR.40) bölümü', () => {
  it('org\'da aktif form yok → feedback.formActive false (durum d, kart gizli)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment())
    // trainingFeedbackForm.findFirst → base mock null

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.feedback.formActive).toBe(false)
    expect(body.feedback.canSubmit).toBe(false)
    expect(body.feedback.submitted).toBe(false)
  })

  it('aktif form + tamamlanmış deneme yok → canSubmit false, attemptId null (durum c)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment())
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })
    // examAttempt.findMany → base mock []

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.formActive).toBe(true)
    expect(body.feedback.canSubmit).toBe(false)
    expect(body.feedback.attemptId).toBeNull()
    expect(body.feedback.submitted).toBe(false)
  })

  it('aktif form + tetikleyen passed deneme → canSubmit true, attemptId doğru (durum b)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment())
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-2', status: 'completed', isPassed: true, attemptNumber: 2 },
    ])

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.canSubmit).toBe(true)
    expect(body.feedback.attemptId).toBe('attempt-2')
  })

  it('bu eğitim için önceki geri bildirim var → submitted true, submittedAt formatlı, canSubmit false (durum a)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment())
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })
    prismaMock.trainingFeedbackResponse.findFirst.mockResolvedValueOnce({
      submittedAt: new Date('2026-05-18T09:00:00Z'),
    })
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-1', status: 'completed', isPassed: true, attemptNumber: 1 },
    ])

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.submitted).toBe(true)
    expect(body.feedback.submittedAt).toBe('18.05.2026')
    // Zaten gönderilmişse tekrar doldurulamaz.
    expect(body.feedback.canSubmit).toBe(false)
  })

  it('feedbackMandatory true → feedback.mandatory true', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { feedbackMandatory: true }),
    )
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.mandatory).toBe(true)
  })

  it('cycle dışı deneme (attemptNumber > originalMaxAttempts) atlanır, ilk tetikleyen seçilir', async () => {
    // attempt-4: cycle dışı (4 > 3) → tetiklenmez. attempt-2: passed, cycle içi → tetiklenir.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { originalMaxAttempts: 3 }),
    )
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-4', status: 'completed', isPassed: false, attemptNumber: 4 },
      { id: 'attempt-2', status: 'completed', isPassed: true, attemptNumber: 2 },
    ])

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.canSubmit).toBe(true)
    expect(body.feedback.attemptId).toBe('attempt-2')
  })

  it('ara başarısız deneme (attemptNumber < originalMaxAttempts) tetiklemez → canSubmit false', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { originalMaxAttempts: 3 }),
    )
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' })
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-1', status: 'completed', isPassed: false, attemptNumber: 1 },
    ])

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) })
    const body = await res.json()

    expect(body.feedback.canSubmit).toBe(false)
    expect(body.feedback.attemptId).toBeNull()
  })
})
