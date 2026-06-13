import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAttemptWithPhaseCheck } from '../exam-helpers'
import { resolveExamFlowState } from '../exam-flow-resolver'

/**
 * NOT: getAttemptStatus ve getActiveOrLatestAttemptStatus testleri KALDIRILDI —
 * fonksiyonlar silindi (atamalar-arası attemptNumber sıralaması N1 bug'ı,
 * Haziran 2026). Attempt tespiti artık resolveExamFlowState'te; davranışı
 * exam-flow-resolver.test.ts kilitler. Bu dosya yalnız getAttemptWithPhaseCheck
 * sözleşmesini test eder (resolver mock'lu — birim sınırı).
 */

// Prisma mock — getAttemptWithPhaseCheck'in tam-kayıt fetch'i için
const mockFindFirst = vi.fn()

vi.mock('../prisma', () => ({
  prisma: {
    examAttempt: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

vi.mock('../exam-flow-resolver', () => ({
  resolveExamFlowState: vi.fn(),
}))

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

function flowWithActive(attempt: Record<string, unknown> | null) {
  return {
    assignment: attempt
      ? {
          id: 'assignment-uuid-1',
          trainingId: 'training-uuid-1',
          status: 'in_progress',
          currentAttempt: 1,
          maxAttempts: 3,
          round: 1,
          dueDate: null,
        }
      : null,
    attempt,
    activeAttempt: attempt,
    stage: (attempt?.status as string) ?? 'none',
    requiredVideoCount: 1,
    noRequiredVideos: false,
    redirect: null,
  } as Awaited<ReturnType<typeof resolveExamFlowState>>
}

beforeEach(() => {
  vi.clearAllMocks()
})

const ORG = 'org-uuid-1'

describe('getAttemptWithPhaseCheck', () => {
  it('resolver aktif attempt bulduğunda tam kaydı id ile çeker ve döner', async () => {
    vi.mocked(resolveExamFlowState).mockResolvedValue(flowWithActive(mockAttempt))
    mockFindFirst.mockResolvedValueOnce(mockAttempt)

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.error).toBeNull()
    expect(result.attempt?.id).toBe('attempt-uuid-1')
    expect(resolveExamFlowState).toHaveBeenCalledWith('assignment-uuid-1', 'user-uuid-1', ORG)
    // Tam-kayıt fetch'i nokta atışı id ile + tenant guard ile yapılmalı.
    const args = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(args.where.id).toBe('attempt-uuid-1')
    expect(args.where.training).toEqual({ organizationId: ORG })
  })

  it('resolver aktif attempt bulamazsa (yalnız terminal/hiç yok) 404 döner', async () => {
    vi.mocked(resolveExamFlowState).mockResolvedValue(flowWithActive(null))

    const result = await getAttemptWithPhaseCheck('uuid-yok', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.attempt).toBeNull()
    expect(result.error).not.toBeNull()
    const body = await result.error!.json()
    expect(body.error).toContain('bulunamadı')
    // Aktif attempt yoksa tam-kayıt fetch'i hiç yapılmamalı.
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('N3 regresyonu: expired attempt resolver tarafından aktif sayılmaz → 404', async () => {
    // Eski kod `status: { not: 'completed' }` kullanıyordu — expired "aktif"
    // sayılıp yanlış faz yönlendirmesi üretiyordu. Resolver activeAttempt'i
    // notIn ['completed','expired'] ile çözer; burada o sözleşme kilitlenir.
    vi.mocked(resolveExamFlowState).mockResolvedValue(flowWithActive(null))

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', 'pre_exam', ORG)

    expect(result.attempt).toBeNull()
    const body = await result.error!.json()
    expect(body.error).toContain('Aktif sınav denemesi bulunamadı')
  })

  it('yanlış aşamada 403 hata döndürür ve redirect bilgisi içerir', async () => {
    const watchingAttempt = { ...mockAttempt, status: 'watching_videos' }
    vi.mocked(resolveExamFlowState).mockResolvedValue(flowWithActive(watchingAttempt))
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
    vi.mocked(resolveExamFlowState).mockResolvedValue(flowWithActive(postAttempt))
    mockFindFirst.mockResolvedValueOnce(postAttempt)

    const result = await getAttemptWithPhaseCheck('assignment-uuid-1', 'user-uuid-1', ['pre_exam', 'post_exam'], ORG)

    expect(result.error).toBeNull()
    expect(result.attempt?.status).toBe('post_exam')
  })
})
