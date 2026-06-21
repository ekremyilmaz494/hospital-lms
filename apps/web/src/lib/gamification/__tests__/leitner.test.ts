import { describe, it, expect } from 'vitest'
import { nextBox, dueDateForBox } from '../leitner'
import { istanbulAddDaysEndOfDayUTC } from '../timezone'
import { LEITNER_INTERVALS, MAX_BOX } from '../constants'

describe('nextBox', () => {
  it('doğru cevap kutuyu +1 artırır', () => {
    expect(nextBox(0, true)).toBe(1)
    expect(nextBox(2, true)).toBe(3)
  })

  it('tavanı (MAX_BOX) aşmaz', () => {
    expect(nextBox(MAX_BOX, true)).toBe(MAX_BOX)
    expect(nextBox(MAX_BOX - 1, true)).toBe(MAX_BOX)
  })

  it('yanlış cevap kutuyu sıfıra düşürür', () => {
    expect(nextBox(5, false)).toBe(0)
    expect(nextBox(1, false)).toBe(0)
    expect(nextBox(0, false)).toBe(0)
  })
})

describe('dueDateForBox', () => {
  const from = new Date('2026-06-21T10:00:00Z')

  it('kutu aralık tablosuna göre nextReviewAt üretir', () => {
    for (let box = 0; box <= MAX_BOX; box++) {
      const expected = istanbulAddDaysEndOfDayUTC(from, LEITNER_INTERVALS[box])
      expect(dueDateForBox(box, from).toISOString()).toBe(expected.toISOString())
    }
  })

  it('kutu 0 → bugün due (interval 0)', () => {
    expect(dueDateForBox(0, from).toISOString()).toBe('2026-06-21T20:59:59.999Z')
  })

  it('aralık tablosu dışındaki kutuları sınırlar (clamp)', () => {
    expect(dueDateForBox(99, from).toISOString()).toBe(dueDateForBox(MAX_BOX, from).toISOString())
    expect(dueDateForBox(-3, from).toISOString()).toBe(dueDateForBox(0, from).toISOString())
  })
})
