import { describe, it, expect } from 'vitest'
import {
  getActionLabel,
  getEntityLabel,
  getEntityBadge,
  getActionBadgeVariant,
  AUDIT_ACTION_LABELS,
} from '@/lib/audit-constants'

describe('audit-constants — Türkçe etiketler', () => {
  it('bilinen action kodu Türkçe döner (İngilizce sızmaz)', () => {
    expect(getActionLabel('exam.passed')).toBe('Sınav Geçildi')
    expect(getActionLabel('feedback.submitted')).toBe('Geri Bildirim Gönderildi')
    expect(getActionLabel('exam.started')).toBe('Sınav Başlatıldı')
    expect(getActionLabel('login')).toBe('Giriş')
  })

  it('bilinen entityType Türkçe + badge döner', () => {
    expect(getEntityLabel('training_feedback_response')).toBe('Eğitim Geri Bildirimi')
    const badge = getEntityBadge('certificate')
    expect(badge.label).toBe('Sertifika')
    expect(badge.variant).toBe('k-badge-success')
  })

  it('bilinmeyen kod ham snake_case yerine humanize edilir', () => {
    // Ham `some_new_thing` değil, boşluklu/baş harf büyük
    expect(getActionLabel('some_new_thing')).toBe('Some New Thing')
    expect(getEntityLabel('brand_new_type')).toBe('Brand New Type')
    expect(getEntityBadge('brand_new_type').variant).toBe('k-badge-muted')
  })

  it('badge varyantı action anlamına göre semantik', () => {
    expect(getActionBadgeVariant('training.delete')).toBe('k-badge-error')
    expect(getActionBadgeVariant('certificate.create')).toBe('k-badge-success')
    expect(getActionBadgeVariant('settings.update')).toBe('k-badge-warning')
    expect(getActionBadgeVariant('data.export')).toBe('k-badge-info')
  })

  it('ekran görüntüsündeki sızıntılar artık eşlenmiş', () => {
    for (const code of ['exam.passed', 'exam.failed', 'exam.started', 'feedback.submitted']) {
      expect(AUDIT_ACTION_LABELS[code]).toBeTruthy()
    }
  })
})
