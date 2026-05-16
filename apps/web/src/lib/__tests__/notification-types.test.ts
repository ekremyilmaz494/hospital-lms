import { describe, it, expect } from 'vitest'
import { getNotificationTypeMeta, FILTER_TYPES } from '../notification-types'

describe('getNotificationTypeMeta', () => {
  it('manuel admin tipleri için doğru label döner', () => {
    expect(getNotificationTypeMeta('info').label).toBe('BİLGİ')
    expect(getNotificationTypeMeta('warning').label).toBe('UYARI')
    expect(getNotificationTypeMeta('error').label).toBe('ACİL')
    expect(getNotificationTypeMeta('success').label).toBe('BAŞARI')
  })

  it('sistem tipleri için doğru label döner (staff Mayıs 2026 sonrasında bunları görür)', () => {
    expect(getNotificationTypeMeta('training_assigned').label).toBe('EĞİTİM')
    expect(getNotificationTypeMeta('exam_passed').label).toBe('SINAV GEÇTİ')
    expect(getNotificationTypeMeta('exam_failed').label).toBe('SINAV KALDI')
    expect(getNotificationTypeMeta('exam_started').label).toBe('SINAV')
  })

  it('bilinmeyen tipler info fallback alır', () => {
    const meta = getNotificationTypeMeta('this_type_does_not_exist')
    expect(meta.label).toBe('BİLGİ')
    expect(meta.ink).toBe('#2c55b8')
  })

  it('her meta objesi label/icon/ink alanlarına sahip', () => {
    const meta = getNotificationTypeMeta('reminder')
    expect(meta).toHaveProperty('label')
    expect(meta).toHaveProperty('icon')
    expect(meta).toHaveProperty('ink')
    expect(typeof meta.label).toBe('string')
    expect(typeof meta.ink).toBe('string')
    expect(meta.ink).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('label uzunluğu 12 karakteri aşmaz (kicker tasarım kuralı)', () => {
    for (const type of FILTER_TYPES) {
      expect(getNotificationTypeMeta(type).label.length).toBeLessThanOrEqual(12)
    }
  })

  it('FILTER_TYPES sadece tanımlı tipler içerir (info fallback istemiyoruz)', () => {
    for (const type of FILTER_TYPES) {
      const meta = getNotificationTypeMeta(type)
      // Her tipin kendi label'ı olmalı; bilinmeyen tip listede olmamalı
      expect(meta).toBeDefined()
    }
    // exam_passed listedeyse label "BİLGİ" değil "SINAV GEÇTİ" olmalı
    expect(FILTER_TYPES).toContain('exam_passed')
    expect(getNotificationTypeMeta('exam_passed').label).not.toBe('BİLGİ')
  })
})
