/**
 * Per-tenant SMTP + professional training-assigned email testleri.
 *
 * Kapsar:
 *  - trainingAssignedEmail template: hastane adı, tüm alanlar, HTML escape, zorunlu badge
 *  - sendEmail({organizationId}): SMTP disabled ise SESSİZCE atla (B seçimi, tenant izolasyonu)
 *  - sendEmail({organizationId}): SMTP enabled ise org transporter kullan + doğru from/replyTo
 *  - sendEmail() (organizationId yok): global transporter + env fallback (invoice/super-admin akışı)
 *  - invalidateOrgTransporter: cache'den düşür + bağlantıyı kapat
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks — vi.hoisted ile üst seviye referans hatasından kaçın ──

const mocks = vi.hoisted(() => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test-msg-id' })
  const closeMock = vi.fn()
  const createTransportMock = vi.fn(() => ({
    sendMail: sendMailMock,
    close: closeMock,
  }))
  const findUniqueMock = vi.fn()
  return { sendMailMock, closeMock, createTransportMock, findUniqueMock }
})

const { sendMailMock, closeMock, createTransportMock, findUniqueMock } = mocks

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransportMock },
  createTransport: mocks.createTransportMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: mocks.findUniqueMock },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/crypto', () => ({
  // Test sabitliği için: "enc:xxx" prefix'iyle basit round-trip
  encrypt: (plain: string) => `enc:${plain}`,
  decrypt: (token: string) => {
    if (!token.startsWith('enc:')) throw new Error('Invalid format')
    return token.slice(4)
  },
}))

// ── Imports (mock'lardan sonra!) ──

import { sendEmail, trainingAssignedEmail, invalidateOrgTransporter, escapeHtml } from '@/lib/email'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

describe('trainingAssignedEmail template', () => {
  const base = {
    staffName: 'Ayşe Yılmaz',
    hospitalName: 'Kızılay Eğitim Hastanesi',
    trainingTitle: 'El Hijyeni Eğitimi',
    endDate: '30 Nisan 2026',
  }

  it('hastane adı header ve footer\'da gözükmeli (tenant-aware)', () => {
    const html = trainingAssignedEmail(base)
    // Header'da adı geçsin
    expect(html).toContain('Kızılay Eğitim Hastanesi')
    // En az 2 kez (header + footer ribbon)
    const count = (html.match(/Kızılay Eğitim Hastanesi/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('staff adı ve eğitim başlığı render edilmeli', () => {
    const html = trainingAssignedEmail(base)
    expect(html).toContain('Ayşe Yılmaz')
    expect(html).toContain('El Hijyeni Eğitimi')
    expect(html).toContain('30 Nisan 2026')
  })

  it('opsiyonel alanlar verildiğinde gösterilmeli', () => {
    const html = trainingAssignedEmail({
      ...base,
      trainingDescription: 'WHO 5 adımlı el yıkama tekniği eğitimi',
      category: 'Enfeksiyon Kontrolü',
      examDurationMinutes: 20,
      passingScore: 75,
      maxAttempts: 3,
      smgPoints: 15,
      assignedByName: 'Dr. Mehmet Demir',
    })
    expect(html).toContain('WHO 5 adımlı el yıkama')
    expect(html).toContain('Enfeksiyon Kontrolü')
    expect(html).toContain('20 dakika')
    expect(html).toContain('75 / 100')
    expect(html).toContain('3 deneme')
    expect(html).toContain('15 puan')
    expect(html).toContain('Dr. Mehmet Demir')
  })

  it('zorunlu eğitimse "Zorunlu" rozeti render edilmeli', () => {
    const html = trainingAssignedEmail({ ...base, isCompulsory: true })
    expect(html).toContain('Zorunlu')

    const htmlOptional = trainingAssignedEmail({ ...base, isCompulsory: false })
    expect(htmlOptional).not.toContain('>Zorunlu<')
  })

  it('HTML injection\'a karşı korunmalı (XSS)', () => {
    const html = trainingAssignedEmail({
      ...base,
      staffName: '<script>alert("xss")</script>',
      trainingTitle: 'Test & <b>bold</b>',
    })
    // Raw script tag içermemeli
    expect(html).not.toContain('<script>alert')
    // Escape'lenmiş olmalı
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Test &amp; &lt;b&gt;')
  })

  it('SMG puanı 0 veya null ise satır gösterilmemeli', () => {
    const html = trainingAssignedEmail({ ...base, smgPoints: 0 })
    expect(html).not.toContain('SMG puanı')

    const html2 = trainingAssignedEmail({ ...base, smgPoints: null })
    expect(html2).not.toContain('SMG puanı')
  })

  it('CTA butonu NEXT_PUBLIC_APP_URL + /staff/my-trainings içermeli', () => {
    const originalUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    const html = trainingAssignedEmail(base)
    expect(html).toContain('https://example.com/staff/my-trainings')
    process.env.NEXT_PUBLIC_APP_URL = originalUrl
  })
})

describe('escapeHtml', () => {
  it('tüm tehlikeli karakterleri kaçırmalı', () => {
    expect(escapeHtml('<b>a&b"c\'d</b>')).toBe('&lt;b&gt;a&amp;b&quot;c&#39;d&lt;/b&gt;')
  })
})

describe('sendEmail — per-tenant SMTP davranışı', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMailMock.mockResolvedValue({ messageId: 'test-msg-id' })
    // Her test arası cache'i temizle (org SMTP cache global)
    invalidateOrgTransporter(ORG_ID)
  })

  it('SMTP disabled ise SESSİZCE atlar (false döner, sendMail çağrılmaz) — B seçimi', async () => {
    findUniqueMock.mockResolvedValueOnce({
      name: 'Test Hastanesi',
      smtpEnabled: false,
      smtpHost: 'smtp.test.com',
      smtpUser: 'user@test.com',
      smtpPassEncrypted: 'enc:secret',
    })

    const sent = await sendEmail({
      organizationId: ORG_ID,
      to: 'staff@test.com',
      subject: 'Test',
      html: '<p>x</p>',
    })

    expect(sent).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('SMTP host yoksa atlar (yanlışlıkla enabled kaldıysa)', async () => {
    findUniqueMock.mockResolvedValueOnce({
      name: 'Test Hastanesi',
      smtpEnabled: true,
      smtpHost: null, // eksik
      smtpUser: 'user@test.com',
      smtpPassEncrypted: 'enc:secret',
    })

    const sent = await sendEmail({
      organizationId: ORG_ID,
      to: 'staff@test.com',
      subject: 'Test',
      html: '<p>x</p>',
    })

    expect(sent).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('SMTP enabled + tüm alanlar dolu → org transporter ile gönderir', async () => {
    findUniqueMock.mockResolvedValueOnce({
      name: 'Kızılay Hastanesi',
      smtpEnabled: true,
      smtpHost: 'smtp.kizilay.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'egitim@kizilay.com',
      smtpPassEncrypted: 'enc:super-secret',
      smtpFrom: 'Kızılay Hastanesi <egitim@kizilay.com>',
      smtpReplyTo: 'destek@kizilay.com',
    })

    const sent = await sendEmail({
      organizationId: ORG_ID,
      to: 'staff@kizilay.com',
      subject: 'Yeni eğitim atandı',
      html: '<p>content</p>',
    })

    expect(sent).toBe(true)
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.kizilay.com',
        port: 587,
        secure: false,
        auth: { user: 'egitim@kizilay.com', pass: 'super-secret' }, // decrypt oldu
      }),
    )
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Kızılay Hastanesi <egitim@kizilay.com>',
        replyTo: 'destek@kizilay.com',
        to: 'staff@kizilay.com',
        subject: 'Yeni eğitim atandı',
      }),
    )
  })

  it('smtpFrom yoksa hastane adı + user\'dan otomatik oluşturulur', async () => {
    findUniqueMock.mockResolvedValueOnce({
      name: 'Test Hospital',
      smtpEnabled: true,
      smtpHost: 'smtp.test.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'noreply@test.com',
      smtpPassEncrypted: 'enc:pass',
      smtpFrom: null,
      smtpReplyTo: null,
    })

    await sendEmail({ organizationId: ORG_ID, to: 'x@x.com', subject: 's', html: 'h' })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Test Hospital <noreply@test.com>',
        replyTo: 'noreply@test.com', // fallback: user
      }),
    )
  })

  it('transporter cache — aynı org için 2 kez çağrılsa tek transporter kullanılır', async () => {
    findUniqueMock.mockResolvedValue({
      name: 'H',
      smtpEnabled: true,
      smtpHost: 'smtp.h.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'u',
      smtpPassEncrypted: 'enc:p',
      smtpFrom: null,
      smtpReplyTo: null,
    })

    await sendEmail({ organizationId: ORG_ID, to: 'a@a.com', subject: 's', html: 'h' })
    await sendEmail({ organizationId: ORG_ID, to: 'b@b.com', subject: 's', html: 'h' })

    // DB sadece 1 kez sorgulansın (cache hit), sendMail 2 kez
    expect(findUniqueMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(2)
  })

  it('invalidateOrgTransporter cache\'i temizler + bağlantıyı kapatır', async () => {
    findUniqueMock.mockResolvedValue({
      name: 'H',
      smtpEnabled: true,
      smtpHost: 'smtp.h.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'u',
      smtpPassEncrypted: 'enc:p',
      smtpFrom: null,
      smtpReplyTo: null,
    })

    await sendEmail({ organizationId: ORG_ID, to: 'a@a.com', subject: 's', html: 'h' })
    expect(findUniqueMock).toHaveBeenCalledTimes(1)

    invalidateOrgTransporter(ORG_ID)
    expect(closeMock).toHaveBeenCalled()

    // Cache temiz → DB'ye yeniden sorgu
    await sendEmail({ organizationId: ORG_ID, to: 'b@b.com', subject: 's', html: 'h' })
    expect(findUniqueMock).toHaveBeenCalledTimes(2)
  })

  it('bozuk şifre decrypt edilemezse atlar (return false)', async () => {
    findUniqueMock.mockResolvedValueOnce({
      name: 'H',
      smtpEnabled: true,
      smtpHost: 'smtp.h.com',
      smtpUser: 'u',
      smtpPassEncrypted: 'invalid-no-prefix', // decrypt fail
    })

    const sent = await sendEmail({
      organizationId: ORG_ID,
      to: 'a@a.com',
      subject: 's',
      html: 'h',
    })

    expect(sent).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('organizationId verilmezse global SMTP kullanır (platform-owned akış)', async () => {
    const sent = await sendEmail({
      to: 'customer@example.com',
      subject: 'Invoice',
      html: '<p>i</p>',
    })

    expect(sent).toBe(true)
    // DB'ye bakmaz — global env kullanır
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Invoice',
      }),
    )
  })
})
