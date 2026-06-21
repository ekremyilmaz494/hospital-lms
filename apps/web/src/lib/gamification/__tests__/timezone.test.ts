import { describe, it, expect } from 'vitest'
import {
  istanbulDateString,
  istanbulEndOfDayUTC,
  istanbulAddDaysEndOfDayUTC,
} from '../timezone'

// Türkiye sabit UTC+3 (DST yok). Bu testler gün-sınırı hesaplarının
// Istanbul takvim gününe sabitlendiğini doğrular.

describe('istanbulDateString', () => {
  it('UTC öğleyi aynı Istanbul gününe çevirir', () => {
    expect(istanbulDateString(new Date('2026-06-21T09:00:00Z'))).toBe('2026-06-21')
  })

  it('gece-yarısı sonrası UTC saatini ERTESI Istanbul gününe kaydırır', () => {
    // 21:30Z = Istanbul 00:30 (ertesi gün) → due hesabı bir önceki güne kaymamalı
    expect(istanbulDateString(new Date('2026-06-21T21:30:00Z'))).toBe('2026-06-22')
  })

  it('UTC gün başı hâlâ aynı Istanbul günü (03:00 öncesi değil)', () => {
    // 02:00Z = Istanbul 05:00 aynı gün
    expect(istanbulDateString(new Date('2026-06-21T02:00:00Z'))).toBe('2026-06-21')
  })
})

describe('istanbulEndOfDayUTC', () => {
  it('Istanbul gün-sonunu (23:59:59.999 yerel) UTC olarak döndürür', () => {
    const eod = istanbulEndOfDayUTC(new Date('2026-06-21T10:00:00Z'))
    // 23:59:59.999 +03:00 = 20:59:59.999Z
    expect(eod.toISOString()).toBe('2026-06-21T20:59:59.999Z')
  })

  it('gece-yarısı sonrası girdide ertesi günün sonunu verir', () => {
    const eod = istanbulEndOfDayUTC(new Date('2026-06-21T21:30:00Z'))
    expect(eod.toISOString()).toBe('2026-06-22T20:59:59.999Z')
  })
})

describe('istanbulAddDaysEndOfDayUTC', () => {
  const base = new Date('2026-06-21T10:00:00Z')

  it('0 gün → bugünün sonu (hemen due)', () => {
    expect(istanbulAddDaysEndOfDayUTC(base, 0).toISOString()).toBe('2026-06-21T20:59:59.999Z')
  })

  it('1 gün → yarının sonu', () => {
    expect(istanbulAddDaysEndOfDayUTC(base, 1).toISOString()).toBe('2026-06-22T20:59:59.999Z')
  })

  it('35 gün → ay sınırını doğru aşar', () => {
    // 2026-06-21 + 35 gün = 2026-07-26
    expect(istanbulAddDaysEndOfDayUTC(base, 35).toISOString()).toBe('2026-07-26T20:59:59.999Z')
  })
})
