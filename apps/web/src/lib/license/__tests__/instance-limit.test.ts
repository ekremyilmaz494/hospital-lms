import { describe, it, expect } from 'vitest'
import { resolveReceiptStatus } from '../instance-limit'

describe('resolveReceiptStatus — lisans instance (klon) limiti', () => {
  it('limit dahilinde → valid', () => {
    expect(resolveReceiptStatus('active', 1, 3)).toEqual({ status: 'valid', overLimit: false })
    expect(resolveReceiptStatus('active', 3, 3)).toEqual({ status: 'valid', overLimit: false }) // eşit ≤ sınır
  })

  it('limiti AŞINCA → revoked (client LOCKED)', () => {
    expect(resolveReceiptStatus('active', 4, 3)).toEqual({ status: 'revoked', overLimit: true })
    expect(resolveReceiptStatus('active', 2, 1)).toEqual({ status: 'revoked', overLimit: true })
  })

  it('maxInstances YOK (eski lisans, undefined) → sınırsız, valid (geriye uyumluluk)', () => {
    expect(resolveReceiptStatus('active', 99, undefined)).toEqual({ status: 'valid', overLimit: false })
  })

  it('maxInstances null (limitsiz kurulum) → valid', () => {
    expect(resolveReceiptStatus('active', 99, null)).toEqual({ status: 'valid', overLimit: false })
  })

  it('lisans zaten revoked → limitten bağımsız revoked (overLimit=false)', () => {
    expect(resolveReceiptStatus('revoked', 1, 3)).toEqual({ status: 'revoked', overLimit: false })
    // revoked + aşım: overLimit yine true değil (durum zaten revoked), ama status revoked
    expect(resolveReceiptStatus('revoked', 5, 3)).toEqual({ status: 'revoked', overLimit: true })
  })
})
