import { describe, it, expect, vi } from 'vitest'

// staff-row.ts modül seviyesinde @/lib/prisma import eder (matchDepartment DB sorgusu);
// resolveHeader saf/DB'siz olduğundan prisma'yı stub'la (DATABASE_URL gerekmesin).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { resolveHeader, HEADER_ALIASES } from '../staff-row'

/**
 * HEADER_ALIASES başlık çözümü — özellikle entegrasyon için EKLENEN externalId
 * (sicil/personel no) aliasları. Canlı smoke testinde (2026-07-03) "sicil" kolonlu
 * bir HBYS CSV'si eşleşmiyordu (externalId aliası yoktu → her satır anahtarsız
 * reddediliyordu). Bu test o düzeltmeyi kilitler.
 */
describe('resolveHeader — externalId (sicil) aliasları', () => {
  it('yaygın Türkçe sicil/personel-no başlıklarını externalId\'ye çözer', () => {
    for (const h of ['sicil', 'sicil no', 'sicilno', 'sicil numarası', 'personel no', 'personel kodu', 'dış kimlik']) {
      expect(resolveHeader(h), h).toBe('externalId')
    }
  })

  it('İngilizce karşılıkları da externalId\'ye çözer', () => {
    for (const h of ['external id', 'externalid', 'employee id', 'employee no', 'staff id']) {
      expect(resolveHeader(h), h).toBe('externalId')
    }
  })

  it('mevcut alanların çözümü bozulmadı (regresyon)', () => {
    expect(resolveHeader('ad')).toBe('firstName')
    expect(resolveHeader('soyad')).toBe('lastName')
    expect(resolveHeader('tc kimlik no')).toBe('tcKimlik')
    expect(resolveHeader('departman')).toBe('department')
    expect(resolveHeader('bilinmeyen-kolon')).toBeNull()
  })

  it('externalId aliasları başka kanonik alanla çakışmıyor', () => {
    const others = Object.entries(HEADER_ALIASES).filter(([k]) => k !== 'externalId').flatMap(([, v]) => v)
    for (const alias of HEADER_ALIASES.externalId) {
      expect(others, alias).not.toContain(alias)
    }
  })
})
