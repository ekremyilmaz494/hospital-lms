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

  it('birden fazla kaynak verildiğinde TÜM belgelere dağıtma talimatı + belge adlarını yazar', () => {
    const out = buildUserPrompt(10, [], ['rehber.pdf', 'sunum.pptx'])
    expect(out).toContain('2 ayrı kaynak belge')
    expect(out).toContain('rehber.pdf')
    expect(out).toContain('sunum.pptx')
    expect(out).toContain('TÜMÜNE dengeli dağıt')
    expect(out).toContain('hiçbir belgeyi atlama')
  })

  it('tek kaynak verildiğinde çoklu-kaynak dağıtma talimatı yazmaz', () => {
    const out = buildUserPrompt(10, [], ['rehber.pdf'])
    expect(out).not.toContain('TÜMÜNE dengeli dağıt')
    expect(out).toContain('ekteki kaynak materyale dayanarak')
  })
})
