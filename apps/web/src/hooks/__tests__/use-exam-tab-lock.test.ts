import { describe, it, expect } from 'vitest'
import { shouldBlock, type ExamTabClaim } from '../use-exam-tab-lock'

const claim = (tabId: string, claimedAt: number): ExamTabClaim => ({ tabId, claimedAt })

describe('shouldBlock', () => {
  it('önce claim eden sekme kazanır — sonraki bloklanır', () => {
    const first = claim('A', 1000)
    const second = claim('B', 2000)
    // İkinci sekme kendini bloklamalı (rakip daha önce claim etmiş).
    expect(shouldBlock(second, first)).toBe(true)
    // İlk sekme bloklanmamalı (rakip daha sonra claim etmiş).
    expect(shouldBlock(first, second)).toBe(false)
  })

  it('aynı claimedAt — tabId tiebreak deterministik', () => {
    const a = claim('A', 1000)
    const b = claim('B', 1000)
    // tabId 'A' < 'B' → A önceliklidir, B bloklanır.
    expect(shouldBlock(b, a)).toBe(true)
    expect(shouldBlock(a, b)).toBe(false)
  })

  it('iki sekme asla birbirini aynı anda bloklamaz', () => {
    const pairs: [ExamTabClaim, ExamTabClaim][] = [
      [claim('A', 1000), claim('B', 2000)],
      [claim('X', 5000), claim('Y', 5000)],
      [claim('m', 99), claim('z', 99)],
    ]
    for (const [x, y] of pairs) {
      // Tam olarak biri bloklanmalı — ikisi birden değil, hiçbiri değil.
      expect(shouldBlock(x, y) !== shouldBlock(y, x)).toBe(true)
    }
  })

  it('aynı sekmenin kendi claim\'i bloklamaz', () => {
    const self = claim('A', 1000)
    expect(shouldBlock(self, { ...self })).toBe(false)
  })
})
