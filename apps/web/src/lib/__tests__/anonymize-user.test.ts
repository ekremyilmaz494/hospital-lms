import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * anonymizeUserData — KVKK m.7 unutulma hakkı tek doğruluk kaynağı.
 * Bu testler anonimleştirme KAPSAMINI kilitler: bir tablo (özellikle imza görseli)
 * atlanırsa üç akış birden (route/purge/cron) sessizce PII bırakır — regresyon engeli.
 */

const mockPrisma = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
  auditLog: { updateMany: vi.fn() },
  certificate: { updateMany: vi.fn() },
  examAttempt: { updateMany: vi.fn() },
  trustedDevice: { deleteMany: vi.fn() },
  pushSubscription: { deleteMany: vi.fn() },
  expoPushToken: { deleteMany: vi.fn() },
  expoPushTicket: { deleteMany: vi.fn() },
  invitation: { updateMany: vi.fn() },
  notification: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { anonymizeUserData, ANON_FIRST_NAME, ANON_LAST_NAME } from '../kvkk/anonymize-user'

beforeEach(() => {
  vi.clearAllMocks()
  // Davet temizliği için helper önce kullanıcının org + e-postasını okur.
  mockPrisma.user.findUnique.mockResolvedValue({ email: 'ali@hastane.com', organizationId: 'org-1' })
  // Her model çağrısı, transaction'a giren op'u geri döndürsün ki dizi uzunluğunu doğrulayalım.
  mockPrisma.user.update.mockImplementation((arg) => ({ op: 'user.update', arg }))
  mockPrisma.auditLog.updateMany.mockImplementation((arg) => ({ op: 'auditLog.updateMany', arg }))
  mockPrisma.certificate.updateMany.mockImplementation((arg) => ({ op: 'certificate.updateMany', arg }))
  mockPrisma.examAttempt.updateMany.mockImplementation((arg) => ({ op: 'examAttempt.updateMany', arg }))
  mockPrisma.trustedDevice.deleteMany.mockImplementation((arg) => ({ op: 'trustedDevice.deleteMany', arg }))
  mockPrisma.pushSubscription.deleteMany.mockImplementation((arg) => ({ op: 'pushSubscription.deleteMany', arg }))
  mockPrisma.expoPushToken.deleteMany.mockImplementation((arg) => ({ op: 'expoPushToken.deleteMany', arg }))
  mockPrisma.expoPushTicket.deleteMany.mockImplementation((arg) => ({ op: 'expoPushTicket.deleteMany', arg }))
  mockPrisma.invitation.updateMany.mockImplementation((arg) => ({ op: 'invitation.updateMany', arg }))
  mockPrisma.notification.deleteMany.mockImplementation((arg) => ({ op: 'notification.deleteMany', arg }))
  mockPrisma.$transaction.mockResolvedValue([])
})

describe('anonymizeUserData — KVKK anonimleştirme kapsamı', () => {
  const USER_ID = '11111111-2222-3333-4444-555555555555'

  it('imza görseli (signatureData) ve imza IP\'sini temizler — potansiyel biyometrik', async () => {
    await anonymizeUserData(USER_ID)
    expect(mockPrisma.examAttempt.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { signatureData: null, signatureIp: null },
    })
  })

  it('User satırında TC + iletişim PII\'sini temizler ve pasifleştirir', async () => {
    await anonymizeUserData(USER_ID)
    const arg = mockPrisma.user.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: USER_ID })
    expect(arg.data).toMatchObject({
      firstName: ANON_FIRST_NAME,
      lastName: ANON_LAST_NAME,
      phone: null,
      avatarUrl: null,
      isActive: false,
      tcEncrypted: null,
      tcHash: null,
      tcAddedAt: null,
      tcAddedBy: null,
    })
    expect(arg.data.email).toMatch(/^deleted_[0-9a-f-]+@anonymized\.local$/)
  })

  it('cihaz kayıtlarını (TrustedDevice IP/UA + push token) siler', async () => {
    await anonymizeUserData(USER_ID)
    expect(mockPrisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
    expect(mockPrisma.expoPushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
    expect(mockPrisma.expoPushTicket.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
  })

  it('davet kaydındaki kimlik PII + TC kopyasını org-scope ile temizler (kabul + bekleyen e-posta)', async () => {
    await anonymizeUserData(USER_ID)
    const arg = mockPrisma.invitation.updateMany.mock.calls[0][0]
    // Cross-tenant koruması: aynı org + (kabul edilmiş VEYA bu e-postayla bekleyen davet)
    expect(arg.where).toEqual({
      organizationId: 'org-1',
      OR: [{ acceptedUserId: USER_ID }, { email: 'ali@hastane.com' }],
    })
    expect(arg.data).toMatchObject({
      firstName: ANON_FIRST_NAME,
      lastName: ANON_LAST_NAME,
      phone: null,
      title: null,
      tcEncrypted: null,
      tcHash: null,
    })
    expect(arg.data.email).toMatch(/^deleted_[0-9a-f-]+@anonymized\.local$/)
  })

  it('audit redaksiyonu, sertifika kodu ve bildirim silmeyi kapsar (11 op tek transaction)', async () => {
    await anonymizeUserData(USER_ID)
    expect(mockPrisma.auditLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entityType: 'User', entityId: USER_ID } }),
    )
    expect(mockPrisma.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { ipAddress: null, userAgent: null },
    })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
    // Tek atomik transaction — 11 işlem
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(11)
  })

  it('kullanıcı bulunamazsa fırlatır ve transaction ÇALIŞMAZ (org-agnostik updateMany kazası önlenir)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(anonymizeUserData(USER_ID)).rejects.toThrow(/bulunamadı/)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('döndürülen anonim e-posta transaction\'da yazılanla aynıdır (idempotent audit)', async () => {
    const { anonymizedEmail } = await anonymizeUserData(USER_ID)
    const written = mockPrisma.user.update.mock.calls[0][0].data.email
    expect(anonymizedEmail).toBe(written)
  })
})
