import { describe, it, expect } from 'vitest'
import {
  isValidAnswer,
  aggregateItemScores,
  calculateOverallScore,
  type FeedbackQuestionType,
} from '../feedback-helpers'

describe('isValidAnswer', () => {
  describe('likert_5', () => {
    it('1-5 arası skoru kabul eder', () => {
      expect(isValidAnswer('likert_5', true, { score: 1 })).toBe(true)
      expect(isValidAnswer('likert_5', true, { score: 5 })).toBe(true)
      expect(isValidAnswer('likert_5', true, { score: 3 })).toBe(true)
    })

    it('0 veya 6+ skoru reddeder', () => {
      expect(isValidAnswer('likert_5', true, { score: 0 })).toBe(false)
      expect(isValidAnswer('likert_5', true, { score: 6 })).toBe(false)
    })

    it('zorunlu soruda eksik cevabı reddeder', () => {
      expect(isValidAnswer('likert_5', true, undefined)).toBe(false)
      expect(isValidAnswer('likert_5', true, {})).toBe(false)
    })

    it('opsiyonel soruda eksik cevabı kabul eder', () => {
      expect(isValidAnswer('likert_5', false, undefined)).toBe(true)
      expect(isValidAnswer('likert_5', false, {})).toBe(true)
    })
  })

  describe('yes_partial_no', () => {
    it('1-3 arası skoru kabul eder', () => {
      expect(isValidAnswer('yes_partial_no', true, { score: 1 })).toBe(true)
      expect(isValidAnswer('yes_partial_no', true, { score: 2 })).toBe(true)
      expect(isValidAnswer('yes_partial_no', true, { score: 3 })).toBe(true)
    })

    it('3+ skoru reddeder', () => {
      expect(isValidAnswer('yes_partial_no', true, { score: 4 })).toBe(false)
      expect(isValidAnswer('yes_partial_no', true, { score: 5 })).toBe(false)
    })
  })

  describe('text', () => {
    it('zorunlu soruda dolu metni kabul eder', () => {
      expect(isValidAnswer('text', true, { textAnswer: 'Güzel bir eğitimdi' })).toBe(true)
    })

    it('zorunlu soruda boş metni reddeder', () => {
      expect(isValidAnswer('text', true, { textAnswer: '' })).toBe(false)
      expect(isValidAnswer('text', true, { textAnswer: '   ' })).toBe(false)
    })

    it('opsiyonel soruda boş metni kabul eder', () => {
      expect(isValidAnswer('text', false, { textAnswer: '' })).toBe(true)
      expect(isValidAnswer('text', false, undefined)).toBe(true)
    })
  })
})

describe('aggregateItemScores', () => {
  it('her item için ortalama ve count hesaplar', () => {
    const answers = [
      { itemId: 'A', score: 5, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'A', score: 3, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'A', score: 4, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'B', score: 1, questionType: 'yes_partial_no' as FeedbackQuestionType },
    ]
    const result = aggregateItemScores(answers)
    expect(result.get('A')).toEqual({ avg: 4, count: 3 })
    expect(result.get('B')).toEqual({ avg: 1, count: 1 })
  })

  it('text tipi soruları atlar (skorlanamaz)', () => {
    const answers = [
      { itemId: 'T', score: null, questionType: 'text' as FeedbackQuestionType },
      { itemId: 'L', score: 5, questionType: 'likert_5' as FeedbackQuestionType },
    ]
    const result = aggregateItemScores(answers)
    expect(result.has('T')).toBe(false)
    expect(result.get('L')?.avg).toBe(5)
  })

  it('null skor olan cevapları atlar', () => {
    const answers = [
      { itemId: 'A', score: null, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'A', score: 4, questionType: 'likert_5' as FeedbackQuestionType },
    ]
    const result = aggregateItemScores(answers)
    expect(result.get('A')).toEqual({ avg: 4, count: 1 })
  })

  it('ondalık ortalamayı 2 basamağa yuvarlar', () => {
    const answers = [
      { itemId: 'A', score: 1, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'A', score: 2, questionType: 'likert_5' as FeedbackQuestionType },
      { itemId: 'A', score: 2, questionType: 'likert_5' as FeedbackQuestionType },
    ]
    const result = aggregateItemScores(answers)
    expect(result.get('A')?.avg).toBe(1.67)
  })

  it('boş liste için boş map döner', () => {
    expect(aggregateItemScores([]).size).toBe(0)
  })
})

describe('calculateOverallScore', () => {
  it('sadece likert_5 sorulardan ortalama hesaplar', () => {
    const answers = [
      { score: 5, questionType: 'likert_5' as FeedbackQuestionType },
      { score: 3, questionType: 'likert_5' as FeedbackQuestionType },
      { score: 1, questionType: 'yes_partial_no' as FeedbackQuestionType }, // atlanır
    ]
    expect(calculateOverallScore(answers)).toBe(4)
  })

  it('hiç likert yanıtı yoksa null döner', () => {
    const answers = [
      { score: 1, questionType: 'yes_partial_no' as FeedbackQuestionType },
      { score: null, questionType: 'text' as FeedbackQuestionType },
    ]
    expect(calculateOverallScore(answers)).toBe(null)
  })

  it('boş listeye null döner', () => {
    expect(calculateOverallScore([])).toBe(null)
  })

  it('null skorları atlar', () => {
    const answers = [
      { score: null, questionType: 'likert_5' as FeedbackQuestionType },
      { score: 4, questionType: 'likert_5' as FeedbackQuestionType },
    ]
    expect(calculateOverallScore(answers)).toBe(4)
  })
})
