import { describe, it, expect, vi } from 'vitest'

// extract.ts modül seviyesinde '@/lib/s3'i import eder; o da '@/lib/prisma'yı
// yükler ve DATABASE_URL yoksa import anında fırlatır. sanitizeEntryPath saf bir
// fonksiyon olduğundan S3 tarafını stub'layıp yalnız guard mantığını test ederiz.
vi.mock('@/lib/s3', () => ({
  uploadBuffer: vi.fn(),
  deleteObject: vi.fn(),
  scormKey: vi.fn(),
}))

import { sanitizeEntryPath } from '../extract'

/**
 * sanitizeEntryPath() zip-slip guard'ının sözleşmesini koruma altına alan testler.
 * (extractScormPackage / cleanupScormKeys jszip + S3 gerektirdiği için burada
 * test edilmez — bunlar saf fonksiyon değildir.)
 *
 * Kural: backslash → '/', './' ve boş segment düşürülür, sonuç göreli+güvenli yol.
 * Reddet (null): '..' segmenti, mutlak yol, Windows sürücü harfi, boş sonuç.
 */

describe('sanitizeEntryPath — kabul edilen yollar', () => {
  it('alt dizinli göreli yolu korur', () => {
    expect(sanitizeEntryPath('content/index.html')).toBe('content/index.html')
  })

  it('kök dosyayı korur', () => {
    expect(sanitizeEntryPath('index.html')).toBe('index.html')
  })

  it('backslash → forward slash', () => {
    expect(sanitizeEntryPath('assets\\img\\a.png')).toBe('assets/img/a.png')
  })

  it('baştaki ./ düşürülür', () => {
    expect(sanitizeEntryPath('./index.html')).toBe('index.html')
  })

  it('ortadaki ./ segmentleri düşürülür', () => {
    expect(sanitizeEntryPath('a/./b/c.js')).toBe('a/b/c.js')
  })
})

describe('sanitizeEntryPath — reddedilen yollar (null)', () => {
  it('.. segmenti reddedilir', () => {
    expect(sanitizeEntryPath('../secret')).toBeNull()
  })

  it('gömülü .. traversal reddedilir', () => {
    expect(sanitizeEntryPath('a/../../etc/passwd')).toBeNull()
  })

  it('mutlak yol reddedilir', () => {
    expect(sanitizeEntryPath('/etc/passwd')).toBeNull()
  })

  it('Windows sürücü harfi reddedilir', () => {
    expect(sanitizeEntryPath('C:\\Windows\\x')).toBeNull()
  })

  it('boş string reddedilir', () => {
    expect(sanitizeEntryPath('')).toBeNull()
  })

  it('yalnız nokta/slash içeren yol reddedilir', () => {
    expect(sanitizeEntryPath('./')).toBeNull()
  })
})
