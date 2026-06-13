import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveExamFlowState } from '../exam-flow-resolver'

/**
 * SINAV AKIŞI ÇÖZÜMLEYİCİ regresyon kilidi (Haziran 2026 kök neden çözümü).
 *
 * En kritik senaryo — N1: attemptNumber atama-BAŞINA benzersizdir
 * (@@unique([assignmentId, attemptNumber])). "Yeniden Ata" (round 2+) sonrası
 * eski atamanın takılı kalmış 3. denemesi, yeni atamanın 1. denemesini
 * GÖLGELEMEMELİ. Eski kod trainingId fallback'inde atamalar-arası
 * `attemptNumber desc` sıraladığı için personel ön sınavı bitirmişken tekrar
 * ön sınava atılıyordu. Resolver: önce ATAMA çözülür (non-terminal öncelikli,
 * round desc), attempt o atamaya scope'lanır.
 */

const prismaMock = vi.hoisted(() => ({
  trainingAssignment: { findFirst: vi.fn() },
  examAttempt: { findFirst: vi.fn() },
  trainingVideo: { count: vi.fn() },
}))

vi.mock('../prisma', () => ({ prisma: prismaMock }))

const USER = 'user-1'
const ORG = 'org-1'
const TRAINING = 'training-1'

const newAssignment = {
  id: 'assignment-round2',
  trainingId: TRAINING,
  status: 'in_progress',
  currentAttempt: 1,
  maxAttempts: 3,
  round: 2,
  dueDate: null,
}

const newAttempt = {
  id: 'attempt-new-1',
  assignmentId: 'assignment-round2',
  trainingId: TRAINING,
  status: 'watching_videos',
  attemptNumber: 1,
  preExamStartedAt: null,
  preExamCompletedAt: new Date('2026-06-10T10:00:00Z'),
  preExamScore: null,
  videosCompletedAt: null,
  postExamStartedAt: null,
  postExamCompletedAt: null,
  isPassed: false,
  createdAt: new Date('2026-06-10T09:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.trainingVideo.count.mockResolvedValue(2)
})

describe('resolveExamFlowState — N1 regresyonu (Yeniden Ata round senaryosu)', () => {
  it('trainingId ile çağrıldığında EN YENİ non-terminal atamanın attempt\'ini döner; eski atamanın yüksek attemptNumber\'ı gölgeleyemez', async () => {
    // id assignmentId olarak eşleşmez → null; non-terminal trainingId fallback'i
    // yeni atamayı (round 2) bulur.
    prismaMock.trainingAssignment.findFirst
      .mockResolvedValueOnce(null) // id eşleşmesi
      .mockResolvedValueOnce(newAssignment) // non-terminal fallback
    prismaMock.examAttempt.findFirst.mockResolvedValueOnce(newAttempt) // aktif (atamaya scope'lu)

    const state = await resolveExamFlowState(TRAINING, USER, ORG)

    expect(state.assignment?.id).toBe('assignment-round2')
    expect(state.attempt?.id).toBe('attempt-new-1')
    expect(state.stage).toBe('watching_videos')

    // KİLİT 1: attempt sorgusu ASLA trainingId ile yapılmaz — yalnız çözülen
    // atamanın id'siyle. (Eski bug: trainingId + attemptNumber desc → eski
    // atamanın attempt #3'ü kazanıyordu.)
    for (const call of prismaMock.examAttempt.findFirst.mock.calls) {
      const where = (call[0] as { where: Record<string, unknown> }).where
      expect(where.assignmentId).toBe('assignment-round2')
      expect(where.trainingId).toBeUndefined()
      expect(where.organizationId).toBe(ORG)
    }

    // KİLİT 2: atama fallback'i non-terminal öncelikli + round desc deterministik.
    const fallbackArgs = prismaMock.trainingAssignment.findFirst.mock.calls[1][0] as {
      where: Record<string, unknown>
      orderBy: unknown
    }
    expect(fallbackArgs.where.trainingId).toBe(TRAINING)
    expect(fallbackArgs.where.status).toEqual({ notIn: ['passed', 'failed', 'locked'] })
    expect(fallbackArgs.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }])
  })

  it('aktif attempt sorgusu terminal statüleri hariç tutar (notIn completed+expired) ve attemptNumber desc kullanır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    prismaMock.examAttempt.findFirst.mockResolvedValueOnce(newAttempt)

    await resolveExamFlowState('assignment-round2', USER, ORG)

    const args = prismaMock.examAttempt.findFirst.mock.calls[0][0] as {
      where: { status: { notIn: string[] } }
      orderBy: unknown
    }
    expect(args.where.status.notIn).toEqual(['completed', 'expired'])
    expect(args.orderBy).toEqual({ attemptNumber: 'desc' })
  })
})

describe('resolveExamFlowState — terminal fallback (Devakent 2026-05-20 semantiği)', () => {
  it('aktif attempt yoksa son attempt\'e (terminal dahil) düşer — "Yeniden Dene" CTA\'sı için görünür', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    const completedAttempt = { ...newAttempt, id: 'attempt-done', status: 'completed' }
    prismaMock.examAttempt.findFirst
      .mockResolvedValueOnce(null) // aktif yok
      .mockResolvedValueOnce(completedAttempt) // terminal latest

    const state = await resolveExamFlowState('assignment-round2', USER, ORG)

    expect(state.attempt?.id).toBe('attempt-done')
    expect(state.activeAttempt).toBeNull() // progress yazımı bunu KULLANMAMALI
    expect(state.stage).toBe('completed')
  })

  it('hiç attempt yoksa stage=none + redirect pre-exam (akış orada başlar)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)

    const state = await resolveExamFlowState('assignment-round2', USER, ORG, {
      currentRoute: 'videos',
    })

    expect(state.stage).toBe('none')
    expect(state.attempt).toBeNull()
    expect(state.redirect).toBe('pre-exam')
  })
})

describe('resolveExamFlowState — kanonikleştirme ve kenar durumlar (N5)', () => {
  it('atama hiç yoksa assignment=null, stage=none, redirect my-trainings', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null)

    const state = await resolveExamFlowState('bilinmeyen-id', USER, ORG, {
      currentRoute: 'videos',
    })

    expect(state.assignment).toBeNull()
    expect(state.stage).toBe('none')
    expect(state.redirect).toBe('my-trainings')
    // Atama yokken attempt sorgusu hiç atılmamalı.
    expect(prismaMock.examAttempt.findFirst).not.toHaveBeenCalled()
  })

  it('atama sorgularının hepsi organizationId ile filtrelenir (tenant izolasyonu)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null)

    await resolveExamFlowState('x', USER, ORG)

    for (const call of prismaMock.trainingAssignment.findFirst.mock.calls) {
      const where = (call[0] as { where: Record<string, unknown> }).where
      expect(where.organizationId).toBe(ORG)
      expect(where.userId).toBe(USER)
    }
  })
})

describe('resolveExamFlowState — noRequiredVideos ve redirect', () => {
  it('watching_videos + zorunlu içerik 0 → noRequiredVideos=true (PDF-only/bozuk transcode sinyali)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    prismaMock.examAttempt.findFirst.mockResolvedValueOnce(newAttempt)
    prismaMock.trainingVideo.count.mockResolvedValue(0)

    const state = await resolveExamFlowState('assignment-round2', USER, ORG)

    expect(state.requiredVideoCount).toBe(0)
    expect(state.noRequiredVideos).toBe(true)
    // Sayım PDF'leri dışlamalı (PDF opsiyonel — son sınav kapısını tetiklemez).
    const countArgs = prismaMock.trainingVideo.count.mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(countArgs.where.contentType).toEqual({ not: 'pdf' })
  })

  it('currentRoute verilince yanlış sayfadaki kullanıcı için redirect hesaplanır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    prismaMock.examAttempt.findFirst.mockResolvedValueOnce(newAttempt) // watching_videos

    const state = await resolveExamFlowState('assignment-round2', USER, ORG, {
      currentRoute: 'pre-exam',
    })

    // Şikayet (a)'nın kilidi: ön sınavı bitirmiş kullanıcı pre-exam'a dönerse
    // sunucu 'videos'a yönlendirir — asla ön sınava geri sokmaz.
    expect(state.redirect).toBe('videos')
  })

  it('doğru sayfadaki kullanıcı için redirect null', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(newAssignment)
    prismaMock.examAttempt.findFirst.mockResolvedValueOnce(newAttempt)

    const state = await resolveExamFlowState('assignment-round2', USER, ORG, {
      currentRoute: 'videos',
    })

    expect(state.redirect).toBeNull()
  })
})
