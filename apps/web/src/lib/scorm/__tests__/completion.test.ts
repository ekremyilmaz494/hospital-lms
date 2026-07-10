import { describe, it, expect } from 'vitest'
import { isScormPassed } from '../completion'

/**
 * Sürümden bağımsız SCORM geçme kararı. Regresyon guard'ı: SCORM 2004 içeriği
 * lesson_status GÖNDERMEZ — completion_status/success_status üstünden karar verilmezse
 * 2004 tamamlaması sertifika/geçiş üretmezdi (hakem NO-GO bulgusu 2026-07-10).
 */
describe('isScormPassed — SCORM 1.2', () => {
  it("lesson_status 'passed' → true", () => {
    expect(isScormPassed({ lessonStatus: 'passed' })).toBe(true)
  })
  it("lesson_status 'completed' → true", () => {
    expect(isScormPassed({ lessonStatus: 'completed' })).toBe(true)
  })
  it("lesson_status 'incomplete' → false", () => {
    expect(isScormPassed({ lessonStatus: 'incomplete' })).toBe(false)
  })
  it("lesson_status 'failed' → false", () => {
    expect(isScormPassed({ lessonStatus: 'failed' })).toBe(false)
  })
  it("lesson_status 'not attempted' → false", () => {
    expect(isScormPassed({ lessonStatus: 'not attempted' })).toBe(false)
  })
})

describe('isScormPassed — SCORM 2004', () => {
  it("success_status 'passed' → true", () => {
    expect(isScormPassed({ successStatus: 'passed' })).toBe(true)
  })
  it("completion_status 'completed' (success unknown) → true", () => {
    expect(isScormPassed({ completionStatus: 'completed', successStatus: 'unknown' })).toBe(true)
  })
  it("completion_status 'completed' AMA success_status 'failed' → false (başarısızlık önceliği)", () => {
    expect(isScormPassed({ completionStatus: 'completed', successStatus: 'failed' })).toBe(false)
  })
  it("completion_status 'incomplete' → false", () => {
    expect(isScormPassed({ completionStatus: 'incomplete', successStatus: 'unknown' })).toBe(false)
  })
  it('lesson_status YOK (2004 tipik gövdesi) ama completion completed → true', () => {
    // 2004 client'ı hiç lessonStatus göndermez — kök regresyon senaryosu.
    expect(isScormPassed({ completionStatus: 'completed' })).toBe(true)
  })
})

describe('isScormPassed — boş/eksik', () => {
  it('hepsi null/undefined → false', () => {
    expect(isScormPassed({})).toBe(false)
    expect(isScormPassed({ lessonStatus: null, completionStatus: null, successStatus: null })).toBe(false)
  })
  it('boş string → false', () => {
    expect(isScormPassed({ lessonStatus: '', completionStatus: '', successStatus: '' })).toBe(false)
  })
  it('büyük/küçük harf + boşluk toleransı', () => {
    expect(isScormPassed({ lessonStatus: '  PASSED ' })).toBe(true)
    expect(isScormPassed({ successStatus: 'Passed' })).toBe(true)
  })
})
