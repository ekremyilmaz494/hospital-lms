import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from '../openrouter-prompt'

describe('buildUserPrompt', () => {
  it('istenen soru sayısını çıktıya yazar', () => {
    const out = buildUserPrompt(7)
    expect(out).toContain('7 adet sınav sorusu')
    expect(out).toContain('7 soru içeren')
  })

  it('excluded verildiğinde mevcut soru metinlerini içerir', () => {
    const out = buildUserPrompt(3, [
      { text: 'El hijyeni ne zaman yapılır?' },
      { text: 'Sterilizasyon süresi kaç dakikadır?' },
    ])
    expect(out).toContain('ZATEN üretilmiş')
    expect(out).toContain('El hijyeni ne zaman yapılır?')
    expect(out).toContain('Sterilizasyon süresi kaç dakikadır?')
  })

  it('excluded boş array verildiğinde "ZATEN üretilmiş" satırı yazmaz', () => {
    const out = buildUserPrompt(5, [])
    expect(out).not.toContain('ZATEN üretilmiş')
  })

  it('excluded omit edildiğinde "ZATEN üretilmiş" satırı yazmaz (varsayılan)', () => {
    const out = buildUserPrompt(5)
    expect(out).not.toContain('ZATEN üretilmiş')
  })
})
