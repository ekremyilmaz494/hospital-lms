import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cron Cleanup — Backup Retention (verify-before-delete) davranış sözleşmesi.
 *
 * Kritik kural: eski yedek silinmeden önce S3'ten download + decrypt + JSON.parse
 * round-trip'i geçmek zorunda. Bu test serisi, "tüm yedekler sessizce bozuldu,
 * cron sonuncusunu da sildi" felaket senaryosunu engelleyen guard'ları koruma altına alır.
 *
 * Diğer cleanup adımları (notification purge, stale attempt expire, vb.)
 * bu test kapsamı dışında — sadece backup retention bloğunu doğruluyoruz.
 * Bu yüzden ilgisiz prisma çağrıları no-op mock'lanıyor.
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
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
  s3Mock: {
    downloadBuffer: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
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

const oldDate = new Date('2025-01-01T00:00:00Z')

function makeOldBackup(overrides: Partial<{
  id: string
  fileUrl: string
  organizationId: string | null
  status: string
}> = {}) {
  return {
    id: 'old-1',
    fileUrl: 'backups/org-1/old.json',
    organizationId: 'org-1',
    status: 'completed',
    createdAt: oldDate,
    ...overrides,
  }
}

describe('Cron Cleanup — Backup Retention (verify-before-delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    prismaMock.dbBackup.findMany.mockReset()
    prismaMock.dbBackup.update.mockResolvedValue({})
    // Gerçek davranışı taklit et — silinen kayıt sayısı = girdideki id sayısı.
    // Sabit { count: 0 } dönersek route'un response'u yanıltıcı görünür.
    prismaMock.dbBackup.deleteMany.mockImplementation((args: { where?: { id?: { in?: string[] } } }) => {
      const ids = args?.where?.id?.in ?? []
      return Promise.resolve({ count: ids.length })
    })
    s3Mock.deleteObject.mockResolvedValue(undefined)
  })

  it('401: yanlış cron secret', async () => {
    const req = new Request('http://localhost/api/cron/cleanup', {
      headers: { Authorization: 'Bearer wrong' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('org\'da yeni verified yedek yoksa eski silinmez (skippedNoRecent)', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([]) // hiçbir org'un yeni verified yedeği yok

    const res = await GET(authedRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.skippedBackupsNoRecent).toBe(1)
    expect(data.deletedBackups).toBe(0)
    expect(data.skippedBackupsVerifyFail).toBe(0)
    expect(s3Mock.downloadBuffer).not.toHaveBeenCalled()
    expect(s3Mock.deleteObject).not.toHaveBeenCalled()
  })

  it('S3 round-trip başarılı: S3 dosyası ve DB row silinir', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('encrypted'))
    cryptoMock.decryptBackup.mockReturnValue('{"users":[]}')

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.deletedBackups).toBe(1)
    expect(data.skippedBackupsVerifyFail).toBe(0)
    expect(data.deletedBackupS3Keys).toBe(1)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('backups/org-1/old.json')
    expect(prismaMock.dbBackup.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1'] } },
    })
  })

  it('S3 download başarısız: DB\'de verification_failed, S3 + DB row korunur', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockRejectedValue(new Error('NoSuchKey'))

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.skippedBackupsVerifyFail).toBe(1)
    expect(data.deletedBackups).toBe(0)
    expect(s3Mock.deleteObject).not.toHaveBeenCalled()
    expect(prismaMock.dbBackup.update).toHaveBeenCalledWith({
      where: { id: 'old-1' },
      data: { status: 'verification_failed', verified: false },
    })
  })

  it('decrypt başarısız (yanlış/dönen anahtar): verification_failed', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('garbage'))
    cryptoMock.decryptBackup.mockImplementation(() => {
      throw new Error('Unsupported state or unable to authenticate data')
    })

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.skippedBackupsVerifyFail).toBe(1)
    expect(data.deletedBackups).toBe(0)
    expect(prismaMock.dbBackup.update).toHaveBeenCalledWith({
      where: { id: 'old-1' },
      data: { status: 'verification_failed', verified: false },
    })
  })

  it('JSON parse başarısız: verification_failed', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('encrypted'))
    cryptoMock.decryptBackup.mockReturnValue('{ broken json')

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.skippedBackupsVerifyFail).toBe(1)
    expect(data.deletedBackups).toBe(0)
  })

  it('boş dosya: decrypt çağrılmaz, verification_failed', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockResolvedValue(Buffer.alloc(0))

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.skippedBackupsVerifyFail).toBe(1)
    expect(cryptoMock.decryptBackup).not.toHaveBeenCalled()
  })

  it('fileUrl="local": S3 atlanır, DB row direkt silinir', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup({ id: 'old-local', fileUrl: 'local' })])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(s3Mock.downloadBuffer).not.toHaveBeenCalled()
    expect(s3Mock.deleteObject).not.toHaveBeenCalled()
    expect(data.deletedBackups).toBe(1)
    expect(prismaMock.dbBackup.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-local'] } },
    })
  })

  it('S3 delete başarısız: DB row korunur (drift önleme)', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('encrypted'))
    cryptoMock.decryptBackup.mockReturnValue('{"users":[]}')
    s3Mock.deleteObject.mockRejectedValue(new Error('AccessDenied'))

    const res = await GET(authedRequest())
    const data = await res.json()

    // S3'ten silinemediği için DB row da silinmemeli — drift'i engelliyoruz
    expect(data.deletedBackups).toBe(0)
    expect(data.deletedBackupS3Keys).toBe(0)
  })

  it('verify-fail durumunda ADMIN_ALERT_EMAIL\'a uyarı gönderilir', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'admin@test.com'

    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([makeOldBackup()])
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer.mockRejectedValue(new Error('NoSuchKey'))

    await GET(authedRequest())

    expect(emailMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        subject: expect.stringMatching(/Yedekleme Uyarısı/),
      }),
    )

    delete process.env.ADMIN_ALERT_EMAIL
  })

  it('karma senaryo: 3 yedek — biri OK, biri verify-fail, biri yenisi yok', async () => {
    prismaMock.dbBackup.findMany
      .mockResolvedValueOnce([
        makeOldBackup({ id: 'ok', fileUrl: 'backups/org-1/ok.json', organizationId: 'org-1' }),
        makeOldBackup({ id: 'fail', fileUrl: 'backups/org-1/fail.json', organizationId: 'org-1' }),
        makeOldBackup({ id: 'no-recent', fileUrl: 'backups/org-2/x.json', organizationId: 'org-2' }),
      ])
      // org-1 yenisi var, org-2 yok
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])

    s3Mock.downloadBuffer
      .mockImplementationOnce(async () => Buffer.from('encrypted-ok'))
      .mockImplementationOnce(async () => { throw new Error('NoSuchKey') })

    cryptoMock.decryptBackup.mockReturnValue('{"users":[]}')

    const res = await GET(authedRequest())
    const data = await res.json()

    expect(data.deletedBackups).toBe(1)         // sadece ok
    expect(data.skippedBackupsVerifyFail).toBe(1) // fail
    expect(data.skippedBackupsNoRecent).toBe(1)   // no-recent (org-2)
  })
})
