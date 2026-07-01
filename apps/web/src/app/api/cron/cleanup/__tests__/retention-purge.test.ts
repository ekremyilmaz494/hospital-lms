import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cron Cleanup — KVKK saklama-süresi imhası davranış sözleşmesi.
 *
 * data-retention politikası "Kimlik/İletişim: üyelik+1 yıl" der; teknik uygulama olmadan
 * pasif personel PII'si süresiz kalıyordu. Bu test cron'un org `dataRetentionDays`'i aşan
 * PASİF STAFF'ı (yalnız `deactivatedAt` damgalı, henüz anonimleştirilmemiş) anonimleştirdiğini
 * ve seçim WHERE'inin admin/aktif/legacy-null/zaten-anonim kayıtları HARİÇ tuttuğunu kilitler.
 */

const { prismaMock, s3Mock, cryptoMock, emailMock, anonymizeMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    examAttempt: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    trainingAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    organization: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    trustedDevice: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    expoPushTicket: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    certificate: { findMany: vi.fn().mockResolvedValue([]) },
    organizationSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    training: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    dbBackup: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    trainingVideo: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
  },
  s3Mock: { downloadBuffer: vi.fn(), deleteObject: vi.fn().mockResolvedValue(undefined), verifyS3Object: vi.fn().mockResolvedValue(null) },
  cryptoMock: { decryptBackup: vi.fn() },
  emailMock: {
    sendEmail: vi.fn().mockResolvedValue(undefined),
    certificateExpiryReminderEmail: vi.fn().mockReturnValue('<p>test</p>'),
    overdueTrainingReminderEmail: vi.fn().mockReturnValue('<p>test</p>'),
  },
  anonymizeMock: { anonymizeUserData: vi.fn().mockResolvedValue({ anonymizedEmail: 'deleted_x@anonymized.local' }) },
  auditMock: { createAuditLog: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/backup-crypto', () => cryptoMock)
vi.mock('@/lib/email', () => emailMock)
vi.mock('@/lib/kvkk/anonymize-user', () => anonymizeMock)
vi.mock('@/lib/api-helpers', () => auditMock)
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { GET } from '../route'

function authedRequest(): Request {
  return new Request('http://localhost/api/cron/cleanup', { headers: { Authorization: 'Bearer test-secret' } })
}

const ORG = { id: 'org-1', dataRetentionDays: 365, notificationRetentionDays: 90, backupRetentionDays: 90 }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret' // secret-scanner-disable-line
  anonymizeMock.anonymizeUserData.mockResolvedValue({ anonymizedEmail: 'deleted_x@anonymized.local' })
  auditMock.createAuditLog.mockResolvedValue(undefined)
})

describe('Cron Cleanup — KVKK saklama-süresi imhası', () => {
  it('süresi aşan pasif staff anonimleştirilir + sistem-audit yazılır', async () => {
    prismaMock.organization.findMany.mockResolvedValue([ORG])
    // org döngülerinde user.findMany yalnız retention bölümünde çağrılır → ilk çağrıya aday ver
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }, { id: 'user-2' }])

    const res = await GET(authedRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.retentionAnonymized).toBe(2)
    expect(anonymizeMock.anonymizeUserData).toHaveBeenCalledWith('user-1')
    expect(anonymizeMock.anonymizeUserData).toHaveBeenCalledWith('user-2')
    // Her anonimleştirme için PII'siz sistem-audit
    expect(auditMock.createAuditLog).toHaveBeenCalledTimes(2)
    const auditArg = auditMock.createAuditLog.mock.calls[0][0]
    expect(auditArg).toMatchObject({ userId: null, action: 'KVKK_DATA_DELETION', entityType: 'User', entityId: 'user-1' })
  })

  it('seçim WHERE\'i admin/aktif/legacy-null/zaten-anonim kayıtları hariç tutar', async () => {
    prismaMock.organization.findMany.mockResolvedValue([ORG])
    prismaMock.user.findMany.mockResolvedValueOnce([])

    await GET(authedRequest())

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.organizationId).toBe('org-1')
    expect(where.role).toBe('staff')
    expect(where.isActive).toBe(false)
    // deactivatedAt < cutoff → null (legacy) otomatik hariç
    expect(where.deactivatedAt.lt).toBeInstanceOf(Date)
    // zaten anonimleştirilmiş kayıtlar tekrar işlenmez (idempotent)
    expect(where.NOT).toEqual({ email: { endsWith: '@anonymized.local' } })
    // 365 gün cutoff makul aralıkta (±1 gün)
    const expectedCutoff = Date.now() - 365 * 24 * 60 * 60 * 1000
    expect(Math.abs(where.deactivatedAt.lt.getTime() - expectedCutoff)).toBeLessThan(24 * 60 * 60 * 1000)
  })

  it('aday yoksa anonimleştirme/audit çağrılmaz (no-op)', async () => {
    prismaMock.organization.findMany.mockResolvedValue([ORG])
    prismaMock.user.findMany.mockResolvedValue([])

    const res = await GET(authedRequest())
    const body = await res.json()
    expect(body.retentionAnonymized).toBe(0)
    expect(anonymizeMock.anonymizeUserData).not.toHaveBeenCalled()
    expect(auditMock.createAuditLog).not.toHaveBeenCalled()
  })

  it('bir kullanıcının anonimleştirmesi patlarsa cron durmaz, diğerleri işlenir', async () => {
    prismaMock.organization.findMany.mockResolvedValue([ORG])
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }, { id: 'user-2' }])
    anonymizeMock.anonymizeUserData
      .mockRejectedValueOnce(new Error('db fail'))
      .mockResolvedValueOnce({ anonymizedEmail: 'deleted_y@anonymized.local' })

    const res = await GET(authedRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.retentionAnonymized).toBe(1) // yalnız user-2 başarılı
  })
})
