import { describe, it, expect } from 'vitest'
import { isIpAllowed, matchIpEntry, isValidIpEntry } from '../ip-allowlist'

describe('matchIpEntry', () => {
  it('tam IPv4 eşleşmesi', () => {
    expect(matchIpEntry('203.0.113.10', '203.0.113.10')).toBe(true)
    expect(matchIpEntry('203.0.113.11', '203.0.113.10')).toBe(false)
  })

  it('CIDR /24 eşleşmesi', () => {
    expect(matchIpEntry('10.0.0.5', '10.0.0.0/24')).toBe(true)
    expect(matchIpEntry('10.0.1.5', '10.0.0.0/24')).toBe(false)
  })

  it('CIDR /8 geniş aralık', () => {
    expect(matchIpEntry('10.255.255.255', '10.0.0.0/8')).toBe(true)
    expect(matchIpEntry('11.0.0.1', '10.0.0.0/8')).toBe(false)
  })

  it('/0 her IPv4 ile eşleşir', () => {
    expect(matchIpEntry('1.2.3.4', '0.0.0.0/0')).toBe(true)
  })

  it('IPv4-mapped IPv6 öneki soyulur', () => {
    expect(matchIpEntry('::ffff:10.0.0.5', '10.0.0.0/24')).toBe(true)
  })

  it('geçersiz CIDR bit sayısı reddedilir', () => {
    expect(matchIpEntry('10.0.0.5', '10.0.0.0/99')).toBe(false)
  })
})

describe('isIpAllowed', () => {
  it('listede eşleşme varsa izin verir', () => {
    expect(isIpAllowed('203.0.113.10', ['10.0.0.0/8', '203.0.113.10'])).toBe(true)
  })

  it('eşleşme yoksa reddeder', () => {
    expect(isIpAllowed('8.8.8.8', ['10.0.0.0/8', '203.0.113.10'])).toBe(false)
  })

  it('boş liste → kimse giremez (güvenli taraf)', () => {
    expect(isIpAllowed('10.0.0.1', [])).toBe(false)
  })

  it('ip yoksa → false', () => {
    expect(isIpAllowed(null, ['10.0.0.0/8'])).toBe(false)
    expect(isIpAllowed(undefined, ['10.0.0.0/8'])).toBe(false)
  })

  it('allowlist dizi değilse → false', () => {
    expect(isIpAllowed('10.0.0.1', 'not-an-array')).toBe(false)
  })
})

describe('isValidIpEntry', () => {
  it('geçerli IPv4 / CIDR / IPv6 kabul', () => {
    expect(isValidIpEntry('203.0.113.10')).toBe(true)
    expect(isValidIpEntry('10.0.0.0/8')).toBe(true)
    expect(isValidIpEntry('2001:db8::1')).toBe(true)
  })

  it('geçersiz girdileri reddeder', () => {
    expect(isValidIpEntry('')).toBe(false)
    expect(isValidIpEntry('999.0.0.1')).toBe(false)
    expect(isValidIpEntry('10.0.0.0/99')).toBe(false)
    expect(isValidIpEntry('not-an-ip')).toBe(false)
  })
})
