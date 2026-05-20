import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAttemptWithPhaseCheck,
  getAttemptStatus,
  getActiveOrLatestAttemptStatus,
} from '../exam-helpers'

// Prisma mock — gerçek DB'ye istek atmadan test
const mockFindFirst = vi.fn()

vi.mock('../prisma', () => ({
  prisma: {
    examAttempt: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

// Tekrar kullanılacak sahte attempt nesnesi
const mockAttempt = {
  id: 'attempt-uuid-1',
  assignmentId: 'assignment-uuid-1',
  trainingId: 'training-uuid-1',
  userId: 'user-uuid-1',
  status: 'pre_exam',
  attemptNumber: 1,
  preExamStartedAt: null,
  videosCompletedAt: null,
  postExamCompletedAt: null,
  preExamCompletedAt: null,
  training: { id: 'training-uuid-1', passingScore: 70, examDurationMinutes: 30 },
  videoProgress: [],
}

beforeEach(() => {
  mockFindFirst.mockReset()
})

const ORG = 'org-uuid-1'

describe('getAttemptWithPhaseCheck', () => {
  it('assignmentId ile aktif denemeyi döndürür', async () => {
    mockFindFirst.mockResolvedValueOnce(mockAttempt)

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.error).toBeNull()
    expect(result.attempt?.id).toBe('attempt-uuid-1')
  })

  it('assignmentId ile bulunamadığında trainingId ile dener', async () => {
    // İlk çağrı (assignmentId) → bulunamadı
    mockFindFirst.mockResolvedValueOnce(null)
    // İkinci çağrı (trainingId) → bulundu
    mockFindFirst.mockResolvedValueOnce(mockAttempt)

    const result = await getAttemptWithPhaseCheck('training-uuid-1', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.error).toBeNull()
    expect(result.attempt?.id).toBe('attempt-uuid-1')
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })

  it('hiç deneme bulunamazsa 404 hata döndürür', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await getAttemptWithPhaseCheck('uuid-yok', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.attempt).toBeNull()
    expect(result.error).not.toBeNull()
    const body = await result.error!.json()
    expect(body.error).toContain('bulunamadı')
  })

  it('yanlış aşamada 403 hata döndürür ve redirect bilgisi içerir', async () => {
    const watchingAttempt = { ...mockAttempt, status: 'watching_videos' }
    mockFindFirst.mockResolvedValueOnce(watchingAttempt)

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.attempt).toBeNull()
    expect(result.error).not.toBeNull()
    const body = await result.error!.json()
    const parsed = JSON.parse(body.error)
    expect(parsed.currentPhase).toBe('watching_videos')
    expect(parsed.redirect).toBe('videos')
  })

  it('birden fazla izin verilen aşama kabul eder', async () => {
    const postAttempt = { ...mockAttempt, status: 'post_exam' }
    mockFindFirst.mockResolvedValueOnce(postAttempt)

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', ['pre_exam', 'post_exam'], ORG)

    expect(result.error).toBeNull()
    expect(result.attempt?.status).toBe('post_exam')
  })
})

describe('getAttemptStatus', () => {
  it('assignmentId ile deneme durumunu döndürür', async () => {
    const statusData = {
      id: 'attempt-uuid-1',
      status: 'watching_videos',
      preExamCompletedAt: new Date('2026-03-27T10:00:00'),
      videosCompletedAt: null,
      postExamCompletedAt: null,
    }
    mockFindFirst.mockResolvedValueOnce(statusData)

    const result = await getAttemptStatus('assignment-uuid-1', 'user-uuid-1', ORG)

    expect(result?.status).toBe('watching_videos')
    expect(result?.preExamCompletedAt).toBeTruthy()
    expect(result?.videosCompletedAt).toBeNull()
  })

  it('assignmentId ile bulunamadığında trainingId ile dener', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    mockFindFirst.mockResolvedValueOnce({ id: 'attempt-uuid-2', status: 'post_exam', preExamCompletedAt: null, videosCompletedAt: null, postExamCompletedAt: null })

    const result = await getAttemptStatus('training-uuid-1', 'user-uuid-1', ORG)

    expect(result?.id).toBe('attempt-uuid-2')
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })

  it('hiç deneme bulunamazsa null döndürür', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await getAttemptStatus('uuid-yok', 'user-uuid-1', ORG)

    expect(result).toBeNull()
  })
})

describe('getActiveOrLatestAttemptStatus', () => {
  // Bu helper'ın amacı: eski terminal attempt (latest attemptNumber) frontend
  // phase guard'ı redirect'e tetiklemesin diye, var olan aktif attempt'i öne
  // çıkarmak. 2026-05-20 Devakent incident: personel ön sınavı tamamlayıp
  // çıkmış, watching_videos durumunda yeni attempt başlattı, ama backend GET
  // /api/exam/[id]/videos eski completed attempt'i döndürünce frontend
  // attemptPhaseRedirect → my-trainings → "video sayfası anlık eğitime atıyor".

  it('aktif attempt varsa onu döner (eski completed attempt göz ardı edilir)', async () => {
    const activeAttempt = {
      id: 'attempt-2',
      status: 'watching_videos',
      preExamCompletedAt: new Date('2026-05-19T10:00:00'),
      videosCompletedAt: null,
      postExamCompletedAt: null,
    }
    // İlk findFirst çağrısı (active, assignmentId) → aktif attempt bulundu
    mockFindFirst.mockResolvedValueOnce(activeAttempt)

    const result = await getActiveOrLatestAttemptStatus('assignment-uuid-1', 'user-uuid-1', ORG)

    expect(result?.id).toBe('attempt-2')
    expect(result?.status).toBe('watching_videos')
    // Aktif bulunduğunda 2. (trainingId) fallback'e VE getAttemptStatus'a düşmemeli
    expect(mockFindFirst).toHaveBeenCalledTimes(1)

    const callArgs = mockFindFirst.mock.calls[0][0] as {
      where: { status?: { notIn?: readonly string[] } }
    }
    expect(callArgs.where.status?.notIn).toEqual(['completed', 'expired'])
  })

  it('aktif attempt yoksa terminal latest attempt\'e düşer (frontend redirect tetiklemesi için doğru)', async () => {
    // 1: aktif assignmentId arama → null
    mockFindFirst.mockResolvedValueOnce(null)
    // 2: aktif trainingId fallback → null
    mockFindFirst.mockResolvedValueOnce(null)
    // 3: getAttemptStatus → assignmentId ile latest (terminal) attempt
    const terminalAttempt = {
      id: 'attempt-1',
      status: 'completed',
      preExamCompletedAt: new Date('2026-05-15T10:00:00'),
      videosCompletedAt: new Date('2026-05-15T11:00:00'),
      postExamCompletedAt: new Date('2026-05-15T12:00:00'),
    }
    mockFindFirst.mockResolvedValueOnce(terminalAttempt)

    const result = await getActiveOrLatestAttemptStatus('assignment-uuid-1', 'user-uuid-1', ORG)

    expect(result?.id).toBe('attempt-1')
    expect(result?.status).toBe('completed')
  })

  it('hiçbir attempt yoksa null döner', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await getActiveOrLatestAttemptStatus('uuid-yok', 'user-uuid-1', ORG)

    expect(result).toBeNull()
  })

  it('assignmentId ile aktif yoksa trainingId ile aktif aranır', async () => {
    // 1: assignmentId + active filter → null
    mockFindFirst.mockResolvedValueOnce(null)
    // 2: trainingId + active filter → bulundu
    const activeViaTraining = {
      id: 'attempt-3',
      status: 'pre_exam',
      preExamCompletedAt: null,
      videosCompletedAt: null,
      postExamCompletedAt: null,
    }
    mockFindFirst.mockResolvedValueOnce(activeViaTraining)

    const result = await getActiveOrLatestAttemptStatus('training-uuid-1', 'user-uuid-1', ORG)

    expect(result?.id).toBe('attempt-3')
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })
})
