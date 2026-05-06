/**
 * trainingAssignedEmail template testleri + escapeHtml.
 *
 * Per-tenant SMTP testleri kaldırıldı — SES merkezi olduğundan beri obsolete.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { trainingAssignedEmail, escapeHtml } from '@/lib/email'

describe('trainingAssignedEmail template', () => {
  const base = {
    staffName: 'Ayşe Yılmaz',
    organizationName: 'Kızılay Eğitim Hastanesi',
    trainingTitle: 'El Hijyeni Eğitimi',
    endDate: '30 Nisan 2026',
  }

  it('hastane adı header ve footer\'da gözükmeli (tenant-aware)', () => {
    const html = trainingAssignedEmail(base)
    expect(html).toContain('Kızılay Eğitim Hastanesi')
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
    expect(html).not.toContain('<script>alert')
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
