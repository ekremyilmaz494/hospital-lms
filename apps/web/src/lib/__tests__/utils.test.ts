import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDate,
  formatDateTime,
  formatDuration,
  getStatusColor,
  getStatusLabel,
  calculatePercentage,
  truncateText,
} from '../utils'

describe('cn', () => {
  it('birleştirir ve çakışan Tailwind sınıflarını merge eder', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('falsy değerleri atlar', () => {
    expect(cn('text-sm', false && 'text-lg', undefined, 'font-bold')).toBe('text-sm font-bold')
  })
})

describe('formatDate', () => {
  it('tarihi GG.AA.YYYY formatında döndürür', () => {
    const result = formatDate('2026-03-27')
    expect(result).toBe('27.03.2026')
  })

  it('Date nesnesi kabul eder', () => {
    const result = formatDate(new Date('2026-01-05'))
    expect(result).toBe('05.01.2026')
  })
})

describe('formatDateTime', () => {
  it('tarih ve saat içerir', () => {
    const result = formatDateTime('2026-03-27T10:30:00')
    expect(result).toContain('27.03.2026')
    expect(result).toContain('10')
    expect(result).toContain('30')
  })
})

describe('formatDuration', () => {
  it('dakika:saniye formatı döndürür (1 saatten az)', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(5)).toBe('0:05')
  })

  it('saat:dakika:saniye formatı döndürür (1 saat ve üzeri)', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(7200)).toBe('2:00:00')
  })

  it('sıfır saniyeyi doğru formatlar', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
})

describe('getStatusColor', () => {
  it('bilinen durumlar için renk döndürür', () => {
    expect(getStatusColor('active')).toBe('success')
    expect(getStatusColor('suspended')).toBe('warning')
    expect(getStatusColor('expired')).toBe('error')
    expect(getStatusColor('passed')).toBe('success')
    expect(getStatusColor('failed')).toBe('error')
    expect(getStatusColor('in_progress')).toBe('warning')
  })

  it('bilinmeyen durum için info döndürür', () => {
    expect(getStatusColor('unknown_status')).toBe('info')
  })
})

describe('getStatusLabel', () => {
  it('Türkçe etiket döndürür', () => {
    expect(getStatusLabel('active')).toBe('Aktif')
    expect(getStatusLabel('passed')).toBe('Başarılı')
    expect(getStatusLabel('failed')).toBe('Başarısız')
    expect(getStatusLabel('in_progress')).toBe('Devam Ediyor')
    expect(getStatusLabel('pre_exam')).toBe('Ön Sınav')
    expect(getStatusLabel('watching_videos')).toBe('Video İzleme')
    expect(getStatusLabel('post_exam')).toBe('Son Sınav')
    expect(getStatusLabel('completed')).toBe('Tamamlandı')
  })

  it('bilinmeyen durum için status değerinin kendisini döndürür', () => {
    expect(getStatusLabel('custom_status')).toBe('custom_status')
  })
})

describe('calculatePercentage', () => {
  it('doğru yüzdeyi hesaplar', () => {
    expect(calculatePercentage(75, 100)).toBe(75)
    expect(calculatePercentage(1, 3)).toBe(33)
    expect(calculatePercentage(2, 3)).toBe(67)
  })

  it('toplam sıfır olduğunda sıfır döndürür (bölme hatasını önler)', () => {
    expect(calculatePercentage(5, 0)).toBe(0)
  })

  it('tam sayıya yuvarlar', () => {
    expect(calculatePercentage(1, 6)).toBe(17)
  })
})

describe('truncateText', () => {
  it('uzun metni keser ve üç nokta ekler', () => {
    const result = truncateText('Merhaba Dünya', 7)
    expect(result).toBe('Merhaba...')
  })

  it('kısa metni değiştirmez', () => {
    expect(truncateText('Kısa', 10)).toBe('Kısa')
  })

  it('tam eşit uzunlukta metni değiştirmez', () => {
    expect(truncateText('Beş K', 5)).toBe('Beş K')
  })
})
