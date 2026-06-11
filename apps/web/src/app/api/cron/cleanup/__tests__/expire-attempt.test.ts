import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cron Cleanup — Stale Exam Attempt Expire davranış sözleşmesi.
 *
 * **KÖK NEDEN** (2026-05-17 Devakent RADYASYON incident, 6 personel kilitlendi):
 * Cron eğitim süresi dolan attempt'leri 'expired' işaretlerken bonus olarak
 * `postExamCompletedAt = new Date()` ve `postExamScore = 0` da yazıyordu.
 * Bu alanlar semantik olarak "kullanıcı son sınava girdi ve 0 aldı" demek;
 * frontend my-trainings detail page bu alanlara bakıp "Aşama TAMAM" gösterip
 * CTA'yı gizliyordu → personel kilitli kalıyor, sınava devam edemiyordu.
 *
 * Bu test serisi, cron'un attempt'i expire ederken **sadece** status ve isPassed'i
 * değiştirdiğini, score/completedAt alanlarına DOKUNMADIĞINI doğrular. Geri gelirse
 * aynı incident tekrarlanır.
 */

const { prismaMock, s3Mock, cryptoMock, emailMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    examAttempt: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    trainingAssignment: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    expoPushTicket: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    certificate: { findMany: vi.fn().mockResolvedValue([]) },
    organizationSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    training: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dbBackup: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    trainingVideo: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  s3Mock: {
    downloadBuffer: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    verifyS3Object: vi.fn().mockResolvedValue(null),
  },
  cryptoMock: {
    decryptBackup: vi.fn(),
  },
  emailMock: {
    sendEmail: vi.fn().mockResolvedValue(undefined),
    certificateExpiryReminderEmail: vi.fn().mockReturnValue('<p>test</p>'),
    overdueTrainingReminderEmail: vi.fn().mockReturnValue('<p>test</p>'),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/backup-crypto', () => cryptoMock)
vi.mock('@/lib/email', () => emailMock)
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET } from '../route'

function authedRequest(): Request {
  return new Request('http://localhost/api/cron/cleanup', {
    headers: { Authorization: 'Bearer test-secret' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('Cron Cleanup — Stale Exam Attempt Expire (Devakent incident regression)', () => {
  it('expired attempt UPDATE\'inde post_exam_completed_at + post_exam_score ASLA yazılmaz', async () => {
    // 1 stale attempt simüle et — training süresi dolmuş
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-1', assignmentId: 'assignment-1' },
    ])

    const res = await GET(authedRequest())
    expect(res.status).toBe(200)

    // Cron'un attempt'i expire ettiğini doğrula
    expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledOnce()

    const callArgs = prismaMock.examAttempt.updateMany.mock.calls[0][0] as {
      where: { id: { in: string[] } }
      data: Record<string, unknown>
    }

    // Doğru attempt'i hedeflediğini doğrula
    expect(callArgs.where.id.in).toEqual(['attempt-1'])

    // ─── KRİTİK INVARIANT (regression guard) ───
    // status + isPassed YETERLİ. Frontend "tamamlandı" hesabı semantik olarak doğru
    // alanlara (postExamStartedAt + postExamCompletedAt) bakar; cron'un bunlara
    // yazma hakkı yoktur. Bu kural geri çıkarsa Devakent-tarzı incident tekrarlanır.
    expect(callArgs.data).toEqual({
      status: 'expired',
      isPassed: false,
    })

    // Açık negatif assertion'lar — yorum okunmasa bile test kırılır
    expect(callArgs.data).not.toHaveProperty('postExamCompletedAt')
    expect(callArgs.data).not.toHaveProperty('postExamScore')
    expect(callArgs.data).not.toHaveProperty('postExamStartedAt')
    expect(callArgs.data).not.toHaveProperty('videosCompletedAt')
    expect(callArgs.data).not.toHaveProperty('preExamScore')
  })

  it('stale attempt yoksa hiç UPDATE çağrılmaz (no-op verify)', async () => {
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([])

    const res = await GET(authedRequest())
    expect(res.status).toBe(200)

    expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
  })
})
