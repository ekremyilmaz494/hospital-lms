import { describe, it, expect } from 'vitest'
import { passwordSchema, PASSWORD_POLICY } from '../password-policy'
import { generateTempPassword } from '../passwords'

describe('passwordSchema (merkezi parola politikası)', () => {
  it('güçlü parolayı kabul eder', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true)
    expect(passwordSchema.safeParse('Klinovax2026?').success).toBe(true)
  })

  it(`min ${PASSWORD_POLICY.minLength} karakterden kısa parolayı reddeder`, () => {
    expect(passwordSchema.safeParse('Ab1!').success).toBe(false)
  })

  it('büyük harf yoksa reddeder', () => {
    expect(passwordSchema.safeParse('abcdef1!').success).toBe(false)
  })

  it('küçük harf yoksa reddeder', () => {
    expect(passwordSchema.safeParse('ABCDEF1!').success).toBe(false)
  })

  it('rakam yoksa reddeder', () => {
    expect(passwordSchema.safeParse('Abcdefg!').success).toBe(false)
  })

  it('özel karakter yoksa reddeder', () => {
    expect(passwordSchema.safeParse('Abcdef12').success).toBe(false)
  })

  it(`max ${PASSWORD_POLICY.maxLength} karakterden uzun parolayı reddeder`, () => {
    const long = 'Ab1!' + 'a'.repeat(PASSWORD_POLICY.maxLength)
    expect(passwordSchema.safeParse(long).success).toBe(false)
  })
})

describe('generateTempPassword politikaya uyumludur (çapraz kontrol)', () => {
  it('üretilen her geçici şifre passwordSchema\'yı geçer', () => {
    // Geçici şifre "Pass"+8hex+"!1" formatında — büyük+küçük+rakam+özel içermeli.
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword()
      expect(passwordSchema.safeParse(pw).success).toBe(true)
    }
  })
})
