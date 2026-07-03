import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cron Cleanup — Orphan Transcode Sweep davranış sözleşmesi.
 *
 * **KÖK NEDEN** (2026-06-11 Devakent incident, 5 video): video-completion lambda
 * DB-match=0 olunca sessizce vazgeçiyordu (retry/DLQ yok) → DB ham '.mp4' key'de
 * kalıyor, S3'te hazır '_720p.mp4' kullanılmıyordu. Mobilde moov-atom-sonda
 * "video yükleniyor" sonsuz dönüyordu.
 *
 * Bu sweep, S3'te _720p GERÇEKTEN varsa (verifyS3Object) video_key'i repoint eder.
 * Test garantileri:
 *  1. _720p mevcutsa → video_key + file_size_bytes güncellenir (video_url'ye DOKUNULMAZ)
 *  2. _720p yoksa (verifyS3Object null) → o satır ATLANIR, repoint edilmez
 *  3. video_url ASLA yazılmaz (CLAUDE.md Video URL Kuralı regresyon koruması)
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
    organization: { findMany: vi.fn().mockResolvedValue([]) },
    trustedDevice: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    syncRowResult: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    syncRun: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
  cryptoMock: { decryptBackup: vi.fn() },
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

const RAW_KEY = 'videos/org-1/training-1/abc-uuid.mp4'
const OUT_KEY = 'videos/org-1/training-1/abc-uuid_720p.mp4'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret' // secret-scanner-disable-line
  // default no-op değerlerini geri yükle (clearAllMocks impl'i de siler)
  s3Mock.verifyS3Object.mockResolvedValue(null)
  prismaMock.trainingVideo.findMany.mockResolvedValue([])
  prismaMock.trainingVideo.update.mockResolvedValue({})
})

describe('Cron Cleanup — Orphan Transcode Sweep (Devakent incident regression)', () => {
  it('_720p S3\'te varsa video_key repoint edilir + file_size_bytes yazılır, video_url\'ye DOKUNULMAZ', async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValueOnce([{ id: 'v-1', videoKey: RAW_KEY }])
    s3Mock.verifyS3Object.mockResolvedValueOnce(31521390) // _720p var, 30MB

    const res = await GET(authedRequest())
    const body = await res.json()
    expect(res.status).toBe(200)

    // HeadObject doğru _720p key'iyle çağrıldı
    expect(s3Mock.verifyS3Object).toHaveBeenCalledWith(OUT_KEY)

    // Repoint update doğru veriyle yapıldı
    expect(prismaMock.trainingVideo.update).toHaveBeenCalledOnce()
    const callArgs = prismaMock.trainingVideo.update.mock.calls[0][0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(callArgs.where).toEqual({ id: 'v-1' })
    expect(callArgs.data.videoKey).toBe(OUT_KEY)
    expect(callArgs.data.fileSizeBytes).toBe(BigInt(31521390))

    // ─── KRİTİK INVARIANT: video_url ASLA yazılmaz ───
    expect(callArgs.data).not.toHaveProperty('videoUrl')

    expect(body.transcodeRepointed).toBe(1)
    expect(body.transcodeStillMissing).toBe(0)
  })

  it('_720p S3\'te YOKSA satır atlanır, repoint edilmez (henüz transcode olmamış videoyu kırma)', async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValueOnce([{ id: 'v-2', videoKey: RAW_KEY }])
    s3Mock.verifyS3Object.mockResolvedValueOnce(null) // _720p yok

    const res = await GET(authedRequest())
    const body = await res.json()
    expect(res.status).toBe(200)

    expect(prismaMock.trainingVideo.update).not.toHaveBeenCalled()
    expect(body.transcodeRepointed).toBe(0)
    expect(body.transcodeStillMissing).toBe(1)
  })

  it('orphan yoksa hiç HeadObject/update çağrılmaz (no-op verify)', async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValueOnce([])

    const res = await GET(authedRequest())
    expect(res.status).toBe(200)

    expect(s3Mock.verifyS3Object).not.toHaveBeenCalled()
    expect(prismaMock.trainingVideo.update).not.toHaveBeenCalled()
  })
})
