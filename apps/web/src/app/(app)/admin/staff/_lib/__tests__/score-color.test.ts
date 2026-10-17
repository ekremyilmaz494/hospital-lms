import { describe, it, expect } from 'vitest'
import { scoreColor, progressVariant } from '../score-color'

describe('score-color — personel puan/ilerleme renkleri', () => {
  describe('scoreColor', () => {
    it('>=80 success, >=60 warning, <60 error (eşik sınırları)', () => {
      expect(scoreColor(100)).toBe('var(--k-success)')
      expect(scoreColor(80)).toBe('var(--k-success)')
      expect(scoreColor(79)).toBe('var(--k-warning)')
      expect(scoreColor(60)).toBe('var(--k-warning)')
      expect(scoreColor(59)).toBe('var(--k-error)')
      expect(scoreColor(0)).toBe('var(--k-error)')
    })
  })

  describe('progressVariant', () => {
    it('>80 success, >50 undefined (nötr), <=50 warning', () => {
      expect(progressVariant(100)).toBe('success')
      expect(progressVariant(81)).toBe('success')
      expect(progressVariant(80)).toBeUndefined()
      expect(progressVariant(51)).toBeUndefined()
      expect(progressVariant(50)).toBe('warning')
      expect(progressVariant(0)).toBe('warning')
    })
  })
})
