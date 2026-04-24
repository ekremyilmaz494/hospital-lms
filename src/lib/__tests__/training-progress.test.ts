import { describe, it, expect } from 'vitest'
import { calculateTrainingProgress } from '../training-progress'

describe('calculateTrainingProgress — examOnly', () => {
  it('examOnly + post-exam yok → 0%', () => {
    const r = calculateTrainingProgress({
      examOnly: true, attemptNumber: 1,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r).toEqual({ completedSteps: 0, totalSteps: 1, percent: 0, isRetry: false, isExamOnly: true })
  })

  it('examOnly + post-exam tamam → 100%', () => {
    const r = calculateTrainingProgress({
      examOnly: true, attemptNumber: 1,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: true,
    })
    expect(r).toEqual({ completedSteps: 1, totalSteps: 1, percent: 100, isRetry: false, isExamOnly: true })
  })

  it('examOnly retry (attempt>1) yine tek adım — pre-exam skip edilmez çünkü yok', () => {
    const r = calculateTrainingProgress({
      examOnly: true, attemptNumber: 3,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.totalSteps).toBe(1)
    expect(r.isRetry).toBe(false) // examOnly için retry flag anlamsız
  })
})

describe('calculateTrainingProgress — normal (3 adım)', () => {
  it('hiçbir şey yok → 0%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 1,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r).toEqual({ completedSteps: 0, totalSteps: 3, percent: 0, isRetry: false, isExamOnly: false })
  })

  it('pre-exam tamam → 33%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 1,
      preExamCompleted: true, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.completedSteps).toBe(1)
    expect(r.percent).toBe(33)
  })

  it('pre-exam + videos → 67%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 1,
      preExamCompleted: true, videosCompleted: true, postExamCompleted: false,
    })
    expect(r.completedSteps).toBe(2)
    expect(r.percent).toBe(67)
  })

  it('hepsi tamam → 100%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 1,
      preExamCompleted: true, videosCompleted: true, postExamCompleted: true,
    })
    expect(r.percent).toBe(100)
  })

  it('attemptNumber=0 (hiç başlamamış atama) → 0% + normal mod', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 0,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.percent).toBe(0)
    expect(r.totalSteps).toBe(3)
    expect(r.isRetry).toBe(false)
  })
})

describe('calculateTrainingProgress — retry (2 adım, pre-exam atlanır)', () => {
  it('attemptNumber=2 → retry modu, 2 adım', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 2,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.isRetry).toBe(true)
    expect(r.totalSteps).toBe(2)
    expect(r.percent).toBe(0)
  })

  it('retry + videos → 50%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 2,
      preExamCompleted: true, videosCompleted: true, postExamCompleted: false,
    })
    expect(r.completedSteps).toBe(1)
    expect(r.percent).toBe(50)
  })

  it('retry + hepsi → 100%', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 2,
      preExamCompleted: true, videosCompleted: true, postExamCompleted: true,
    })
    expect(r.percent).toBe(100)
  })

  it('needsRetry override — attemptNumber=1 ama failed durumda retry görünür', () => {
    const r = calculateTrainingProgress({
      examOnly: false, attemptNumber: 1, needsRetry: true,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.isRetry).toBe(true)
    expect(r.totalSteps).toBe(2)
  })

  it('examOnly + needsRetry → yine examOnly (retry yok)', () => {
    const r = calculateTrainingProgress({
      examOnly: true, attemptNumber: 1, needsRetry: true,
      preExamCompleted: false, videosCompleted: false, postExamCompleted: false,
    })
    expect(r.isExamOnly).toBe(true)
    expect(r.isRetry).toBe(false)
    expect(r.totalSteps).toBe(1)
  })
})
