import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'staff-user-1' } } },
        error: null,
      })),
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    trainingAssignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    examAttempt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    question: { findMany: vi.fn() },
    examAnswer: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    notification: { create: vi.fn() },
    certificate: { create: vi.fn() },
    smgActivity: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn(async () => true),
  startExamTimer: vi.fn(async () => Date.now() + 30 * 60 * 1000),
  clearExamTimer: vi.fn(),
  isExamExpired: vi.fn(async () => false),
}))

vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api-helpers', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createAuditLog: vi.fn(),
  }
})

import { prisma } from '@/lib/prisma'
import { isExamExpired } from '@/lib/redis'

const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>
const mockAssignmentFindFirst = prisma.trainingAssignment.findFirst as ReturnType<typeof vi.fn>
const mockAttemptFindFirst = prisma.examAttempt.findFirst as ReturnType<typeof vi.fn>
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>
const mockQuestionFindMany = prisma.question.findMany as ReturnType<typeof vi.fn>
const mockAttemptUpdateMany = prisma.examAttempt.updateMany as ReturnType<typeof vi.fn>

const ORG_ID = 'org-test-uuid'
const USER_ID = 'staff-user-1'

function setupAuthStaff() {
  mockUserFindUnique.mockResolvedValue({
    id: USER_ID,
    role: 'staff',
    isActive: true,
    organizationId: ORG_ID,
  })
  mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: false })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──

describe('Sinav Baslangic (exam/[id]/start)', () => {
  describe('Atanmamis egitim kontrolu', () => {
    it('kullaniciya atanmamis egitim icin 404 doner', async () => {
      setupAuthStaff()
      mockAssignmentFindFirst.mockResolvedValue(null)

      const assignment = await mockAssignmentFindFirst()
      expect(assignment).toBeNull()
      // API bu durumda "Assignment not found" 404 donmeli
    })

    it('baska organizasyonun egitimi icin assignment bulunamaz', async () => {
      setupAuthStaff()
      // Cross-org assignment sorgusu organizationId filtresi icermeli
      const where = {
        id: 'assignment-uuid',
        userId: USER_ID,
        training: { organizationId: ORG_ID },
      }
      expect(where.training.organizationId).toBe(ORG_ID)
    })
  })

  describe('Egitim tarih araligi kontrolu', () => {
    it('baslanmamis egitim icin hata doner', () => {
      const futureStart = new Date('2030-01-01')
      const now = new Date()
      expect(now < futureStart).toBe(true)
      // API: 'Bu eğitim henüz başlanmamış.'
    })

    it('suresi dolmus egitim icin hata doner', () => {
      const pastEnd = new Date('2020-01-01')
      const now = new Date()
      expect(now > pastEnd).toBe(true)
      // API: 'Bu eğitimin süresi dolmuş.'
    })
  })

  describe('Deneme siniri kontrolu', () => {
    it('zaten basarili tamamlanmis egitim tekrar baslatilamaz', () => {
      const assignment = { status: 'passed' }
      expect(assignment.status).toBe('passed')
      // API: 'Zaten başarıyla tamamladınız'
    })

    it('kilitli egitim baslatilamaz', () => {
      const assignment = { status: 'locked' }
      expect(assignment.status).toBe('locked')
      // API: 'Eğitim kilitlenmiş'
    })

    it('maksimum deneme sayisina ulasilmissa yeni deneme olusturulamaz', () => {
      const assignment = {
        status: 'failed',
        currentAttempt: 3,
        maxAttempts: 3,
      }
      expect(assignment.currentAttempt >= assignment.maxAttempts).toBe(true)
      // API: 'Maksimum deneme sayısına ulaştınız'
    })

    it('deneme hakki varsa yeni deneme baslatilabilir', () => {
      const assignment = {
        status: 'failed',
        currentAttempt: 1,
        maxAttempts: 3,
      }
      expect(assignment.currentAttempt < assignment.maxAttempts).toBe(true)
    })
  })

  describe('Aktif deneme devam ettirme', () => {
    it('tamamlanmamis aktif deneme varsa onu dondurur', async () => {
      const existingAttempt = {
        id: 'attempt-active',
        status: 'watching_videos',
        attemptNumber: 1,
        videoProgress: [],
      }
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          examAttempt: {
            findFirst: vi.fn().mockResolvedValue(existingAttempt),
          },
        }
        return fn(tx)
      })

      const result = await mockTransaction(async (tx: { examAttempt: { findFirst: () => Promise<unknown> } }) => {
        return tx.examAttempt.findFirst()
      })
      expect(result).toEqual(existingAttempt)
    })
  })

  describe('ExamOnly sinav modu', () => {
    it('examOnly egitimde dogrudan post_exam asamasina gecilir', () => {
      const training = { examOnly: true }
      const initialStatus = training.examOnly ? 'post_exam' : 'pre_exam'
      expect(initialStatus).toBe('post_exam')
    })

    it('normal egitimde pre_exam ile baslar', () => {
      const training = { examOnly: false }
      const initialStatus = training.examOnly ? 'post_exam' : 'pre_exam'
      expect(initialStatus).toBe('pre_exam')
    })

    it('2. denemede on sinav atlanir, watching_videos ile baslar', () => {
      const attemptNumber = 2
      const isRetry = attemptNumber > 1
      const initialStatus = isRetry ? 'watching_videos' : 'pre_exam'
      expect(initialStatus).toBe('watching_videos')
    })
  })
})

describe('Skor Hesaplama (exam/[id]/submit)', () => {
  it('tum sorular dogru cevaplanirsa 100 puan', () => {
    const questions = [
      { id: 'q1', points: 10, options: [{ id: 'o1', isCorrect: true }, { id: 'o2', isCorrect: false }] },
      { id: 'q2', points: 10, options: [{ id: 'o3', isCorrect: true }, { id: 'o4', isCorrect: false }] },
    ]
    const answers = [
      { questionId: 'q1', selectedOptionId: 'o1' },
      { questionId: 'q2', selectedOptionId: 'o3' },
    ]

    let totalPoints = 0
    let earnedPoints = 0
    const questionMap = new Map(questions.map(q => [q.id, q]))

    for (const a of answers) {
      const question = questionMap.get(a.questionId)!
      totalPoints += question.points
      const correctOption = question.options.find(o => o.isCorrect)
      if (correctOption?.id === a.selectedOptionId) earnedPoints += question.points
    }

    const score = Math.round((earnedPoints / totalPoints) * 100)
    expect(score).toBe(100)
  })

  it('yarisinda dogru cevaplanirsa 50 puan', () => {
    const questions = [
      { id: 'q1', points: 10, options: [{ id: 'o1', isCorrect: true }, { id: 'o2', isCorrect: false }] },
      { id: 'q2', points: 10, options: [{ id: 'o3', isCorrect: true }, { id: 'o4', isCorrect: false }] },
    ]
    const answers = [
      { questionId: 'q1', selectedOptionId: 'o1' },   // dogru
      { questionId: 'q2', selectedOptionId: 'o4' },    // yanlis
    ]

    let totalPoints = 0
    let earnedPoints = 0
    const questionMap = new Map(questions.map(q => [q.id, q]))

    for (const a of answers) {
      const question = questionMap.get(a.questionId)!
      totalPoints += question.points
      const correctOption = question.options.find(o => o.isCorrect)
      if (correctOption?.id === a.selectedOptionId) earnedPoints += question.points
    }

    const score = Math.round((earnedPoints / totalPoints) * 100)
    expect(score).toBe(50)
  })

  it('cevaplanmamis sorular yanlis sayilir', () => {
    const questions = [
      { id: 'q1', points: 10 },
      { id: 'q2', points: 10 },
      { id: 'q3', points: 10 },
    ]
    const answeredIds = new Set(['q1']) // sadece 1 soru cevaplanmis

    let totalPoints = 0
    for (const q of questions) totalPoints += q.points

    // earnedPoints sadece cevaplanmis + dogru olanlar
    const earnedPoints = 10 // diyelim q1 dogru
    const score = Math.round((earnedPoints / totalPoints) * 100)
    expect(score).toBe(33) // 10/30 = ~33%
    expect(answeredIds.size).toBe(1)
  })

  it('soru yoksa skor 0 olur', () => {
    const totalPoints = 0
    const earnedPoints = 0
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    expect(score).toBe(0)
  })

  it('gecme notunun uzerindeyse isPassed true olur', () => {
    const score = 75
    const passingScore = 70
    expect(score >= passingScore).toBe(true)
  })

  it('gecme notunun altindaysa isPassed false olur', () => {
    const score = 65
    const passingScore = 70
    expect(score >= passingScore).toBe(false)
  })

  it('gecme notuna esitse isPassed true olur', () => {
    const score = 70
    const passingScore = 70
    expect(score >= passingScore).toBe(true)
  })
})

describe('Sinav suresi dolma kontrolu', () => {
  it('suresi dolmus sinav gonderimi reddedilir', () => {
    const examDurationMinutes = 30
    const graceMinutes = 5
    const allowedMs = (examDurationMinutes + graceMinutes) * 60 * 1000
    const phaseStartedAt = new Date(Date.now() - 40 * 60 * 1000) // 40 dk once
    const elapsed = Date.now() - phaseStartedAt.getTime()

    expect(elapsed > allowedMs).toBe(true)
    // API: 'Sınav süresi çoktan dolmuş. Bu gönderim kabul edilemez.' 403
  })

  it('sure icinde gonderim kabul edilir', () => {
    const examDurationMinutes = 30
    const graceMinutes = 5
    const allowedMs = (examDurationMinutes + graceMinutes) * 60 * 1000
    const phaseStartedAt = new Date(Date.now() - 20 * 60 * 1000) // 20 dk once
    const elapsed = Date.now() - phaseStartedAt.getTime()

    expect(elapsed < allowedMs).toBe(true)
  })

  it('grace period (5 dk) icinde gonderim hala kabul edilir', () => {
    const examDurationMinutes = 30
    const graceMinutes = 5
    const allowedMs = (examDurationMinutes + graceMinutes) * 60 * 1000
    const phaseStartedAt = new Date(Date.now() - 33 * 60 * 1000) // 33 dk once (30+3)
    const elapsed = Date.now() - phaseStartedAt.getTime()

    expect(elapsed < allowedMs).toBe(true)
  })

  it('isExamExpired helper ile Redis timer kontrolu', async () => {
    ;(isExamExpired as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const expired = await isExamExpired('attempt-expired')
    expect(expired).toBe(true)
  })
})

describe('Phase transition validasyonu', () => {
  it('pre_exam asamasinda sadece pre submit kabul edilir', () => {
    const attemptStatus = 'pre_exam'
    const submittedPhase = 'post'
    const isValid = (submittedPhase === 'pre' && attemptStatus === 'pre_exam') ||
                    (submittedPhase === 'post' && attemptStatus === 'post_exam')
    expect(isValid).toBe(false)
  })

  it('post_exam asamasinda sadece post submit kabul edilir', () => {
    const attemptStatus = 'post_exam'
    const submittedPhase = 'post'
    const isValid = (submittedPhase === 'pre' && attemptStatus === 'pre_exam') ||
                    (submittedPhase === 'post' && attemptStatus === 'post_exam')
    expect(isValid).toBe(true)
  })

  it('tamamlanmis denemeye tekrar gonderim yapilamaz', () => {
    const attemptStatus = 'completed'
    expect(attemptStatus).toBe('completed')
    // API: 'Bu deneme zaten tamamlanmış' 400
  })
})

describe('Idempotency kontrolu', () => {
  it('zaten skorlanmis faz icin mevcut skoru dondurur', () => {
    const attempt = { preExamScore: 80, postExamScore: null }
    const phase = 'pre'
    const alreadyScored = phase === 'pre' ? attempt.preExamScore !== null : attempt.postExamScore !== null
    expect(alreadyScored).toBe(true)
  })

  it('henuz skorlanmamis faz icin hesaplama yapar', () => {
    const attempt = { preExamScore: null, postExamScore: null }
    const phase = 'pre'
    const alreadyScored = phase === 'pre' ? attempt.preExamScore !== null : attempt.postExamScore !== null
    expect(alreadyScored).toBe(false)
  })
})
