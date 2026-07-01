import { describe, it, expect } from 'vitest'
import { maskEmail, maskPhone, maskIp } from '../pii-mask'

describe('pii-mask — KVKK log maskeleme', () => {
  describe('maskEmail', () => {
    it('yerel kısmı maskeler, domaini korur (tenant teşhisi)', () => {
      expect(maskEmail('ahmet@hastane.com')).toBe('ah***@hastane.com')
    })
    it('kısa yerel kısımda en az 1 yıldız kalır', () => {
      expect(maskEmail('a@x.com')).toBe('a*@x.com')
    })
    it('tam e-postayı asla düz sızdırmaz', () => {
      const out = maskEmail('gizli.kullanici@ornek.org')
      expect(out).not.toContain('gizli.kullanici')
      expect(out.endsWith('@ornek.org')).toBe(true)
    })
    it('boş/geçersiz güvenli', () => {
      expect(maskEmail('')).toBe('')
      expect(maskEmail(null)).toBe('')
      expect(maskEmail('@yok')).toBe('***')
    })
  })

  describe('maskPhone', () => {
    it('yalnız son 4 haneyi bırakır', () => {
      expect(maskPhone('0553 953 06 96')).toBe('***0696')
      expect(maskPhone('+905539530696')).toBe('***0696')
    })
    it('tam numarayı sızdırmaz', () => {
      expect(maskPhone('05539530696')).not.toContain('5539')
    })
    it('boş/kısa güvenli', () => {
      expect(maskPhone(null)).toBe('')
      expect(maskPhone('12')).toBe('***')
    })
  })

  describe('maskIp', () => {
    it('IPv4 son okteti gizler', () => {
      expect(maskIp('85.100.23.47')).toBe('85.100.23.x')
    })
    it('x-forwarded-for zincirinde ilk (istemci) IP maskelenir', () => {
      expect(maskIp('85.100.23.47, 10.0.0.1')).toBe('85.100.23.x')
    })
    it('IPv6 son grubu gizler', () => {
      expect(maskIp('2001:db8::1a2b')).toBe('2001:db8::x')
    })
    it('boş güvenli', () => {
      expect(maskIp(null)).toBe('')
      expect(maskIp('unknown')).toBe('***')
    })
  })
})
