/**
 * Lisans durum makinesi testleri — kademeli kilit (VALID → WARN → READONLY →
 * LOCKED) tüm kenarlarıyla. Saf fonksiyon: fixture + sabit NOW, kripto yok.
 */
import { describe, it, expect } from 'vitest'

import {
  computeLicenseState,
  READONLY_GRACE_DAYS,
  type LicenseSnapshot,
} from '@/lib/license/state'
import type { LicenseClaims, ReceiptClaims } from '@/lib/license/schema'

const NOW = new Date('2026-07-02T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * DAY_MS)
const unixDaysFromNow = (d: number) => Math.floor((NOW.getTime() + d * DAY_MS) / 1000)

const LICENSE_ID = '11111111-1111-4111-8111-111111111111'
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222'

function makeClaims(overrides: Partial<LicenseClaims> = {}): LicenseClaims {
  return {
    iss: 'klinovax-license',
    jti: LICENSE_ID,
    sub: 'test-hastanesi',
    iat: unixDaysFromNow(-100),
    schemaVersion: 1,
    customerName: 'Test Hastanesi',
    licenseType: 'standard',
    validUntil: daysFromNow(365).toISOString(),
    limits: { maxOrganizations: 3, maxStaff: 500 },
    graceDays: 14,
    ...overrides,
  }
}

function makeReceipt(overrides: Partial<ReceiptClaims> = {}): ReceiptClaims {
  return {
    iss: 'klinovax-receipt',
    licenseId: LICENSE_ID,
    instanceId: INSTANCE_ID,
    status: 'valid',
    iat: unixDaysFromNow(-1),
    exp: unixDaysFromNow(34),
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<LicenseSnapshot> = {}): LicenseSnapshot {
  return {
    claims: makeClaims(),
    receipt: makeReceipt(),
    activatedAt: daysFromNow(-60),
    clockWatermark: new Date(NOW.getTime() - 60 * 60 * 1000),
    ...overrides,
  }
}

describe('computeLicenseState — NO_LICENSE', () => {
  it('lisans yoksa NO_LICENSE / no_license', () => {
    const s = computeLicenseState(makeSnapshot({ claims: null }), NOW)
    expect(s.state).toBe('NO_LICENSE')
    expect(s.reasons).toEqual(['no_license'])
    expect(s.limits).toBeNull()
  })

  it('imza düşmüşse NO_LICENSE / signature_invalid (DB tamper)', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: null, signatureInvalid: true }),
      NOW,
    )
    expect(s.state).toBe('NO_LICENSE')
    expect(s.reasons).toEqual(['signature_invalid'])
  })
})

describe('computeLicenseState — VALID', () => {
  it('uzak bitiş + taze makbuz → VALID', () => {
    const s = computeLicenseState(makeSnapshot(), NOW)
    expect(s.state).toBe('VALID')
    expect(s.daysToExpiry).toBe(365)
    expect(s.offlineDaysLeft).toBe(13)
    expect(s.customerName).toBe('Test Hastanesi')
    expect(s.limits).toEqual({ maxOrganizations: 3, maxStaff: 500 })
  })

  it('süresiz lisans (validUntil=null) → VALID, daysToExpiry=null', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: makeClaims({ validUntil: null }) }),
      NOW,
    )
    expect(s.state).toBe('VALID')
    expect(s.daysToExpiry).toBeNull()
  })

  it('makbuz hiç yoksa grace çapası activatedAt → 2 gün önce aktive edilmiş kurulum VALID', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: null, activatedAt: daysFromNow(-2) }),
      NOW,
    )
    expect(s.state).toBe('VALID')
    expect(s.offlineDaysLeft).toBe(12)
  })
})

describe('computeLicenseState — WARN', () => {
  it('bitişe 29 gün → WARN / expiring_soon', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: makeClaims({ validUntil: daysFromNow(29).toISOString() }) }),
      NOW,
    )
    expect(s.state).toBe('WARN')
    expect(s.reasons).toContain('expiring_soon')
    expect(s.daysToExpiry).toBe(29)
  })

  it('offline grace yarıyı geçti (8/14 gün) → WARN / offline_warning', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: makeReceipt({ iat: unixDaysFromNow(-8) }) }),
      NOW,
    )
    expect(s.state).toBe('WARN')
    expect(s.reasons).toEqual(['offline_warning'])
  })

  it('iki uyarı bir arada: yaklaşan bitiş + offline', () => {
    const s = computeLicenseState(
      makeSnapshot({
        claims: makeClaims({ validUntil: daysFromNow(10).toISOString() }),
        receipt: makeReceipt({ iat: unixDaysFromNow(-9) }),
      }),
      NOW,
    )
    expect(s.state).toBe('WARN')
    expect(s.reasons).toEqual(['expiring_soon', 'offline_warning'])
  })

  it('bitişe 31 gün → henüz VALID (30 gün eşiği)', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: makeClaims({ validUntil: daysFromNow(31).toISOString() }) }),
      NOW,
    )
    expect(s.state).toBe('VALID')
  })
})

describe('computeLicenseState — READONLY (bitiş sonrası 7 gün)', () => {
  it('bitişten 3 gün sonra → READONLY / expired', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: makeClaims({ validUntil: daysFromNow(-3).toISOString() }) }),
      NOW,
    )
    expect(s.state).toBe('READONLY')
    expect(s.reasons).toEqual(['expired'])
    expect(s.daysToExpiry).toBe(-3)
  })

  it('bitiş günü (daysToExpiry=0) → READONLY', () => {
    const s = computeLicenseState(
      makeSnapshot({
        claims: makeClaims({ validUntil: new Date(NOW.getTime() - 60_000).toISOString() }),
      }),
      NOW,
    )
    expect(s.state).toBe('READONLY')
  })
})

describe('computeLicenseState — LOCKED', () => {
  it(`bitişten ${READONLY_GRACE_DAYS} gün sonra (salt-okunur pencere bitti) → LOCKED / expired`, () => {
    const s = computeLicenseState(
      makeSnapshot({
        claims: makeClaims({ validUntil: daysFromNow(-READONLY_GRACE_DAYS).toISOString() }),
      }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['expired'])
  })

  it('bitişten 8 gün sonra → LOCKED', () => {
    const s = computeLicenseState(
      makeSnapshot({ claims: makeClaims({ validUntil: daysFromNow(-8).toISOString() }) }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
  })

  it('makbuz revoked → LOCKED / revoked (uzaktan iptal)', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: makeReceipt({ status: 'revoked' }) }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['revoked'])
  })

  it('15 gün offline (grace 14) → LOCKED / offline_grace_exceeded', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: makeReceipt({ iat: unixDaysFromNow(-15) }) }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['offline_grace_exceeded'])
    expect(s.offlineDaysLeft).toBe(0)
  })

  it('süresiz lisans bile offline grace aşınca kilitlenir', () => {
    const s = computeLicenseState(
      makeSnapshot({
        claims: makeClaims({ validUntil: null }),
        receipt: makeReceipt({ iat: unixDaysFromNow(-15) }),
      }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['offline_grace_exceeded'])
  })

  it('makbuz yok + aktivasyon 15 gün önce → LOCKED (çapa activatedAt)', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: null, activatedAt: daysFromNow(-15) }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['offline_grace_exceeded'])
  })

  it('çapa hiç yoksa (activatedAt=null, makbuz yok) fail-closed → LOCKED', () => {
    const s = computeLicenseState(
      makeSnapshot({ receipt: null, activatedAt: null }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['offline_grace_exceeded'])
  })

  it('saat 3 gün geri alınmış (watermark ileride) → LOCKED / clock_tampering', () => {
    const s = computeLicenseState(
      makeSnapshot({ clockWatermark: daysFromNow(3) }),
      NOW,
    )
    expect(s.state).toBe('LOCKED')
    expect(s.reasons).toEqual(['clock_tampering'])
  })

  it('watermark 23 saat ileride → tolerans içinde, kilit YOK', () => {
    const s = computeLicenseState(
      makeSnapshot({ clockWatermark: new Date(NOW.getTime() + 23 * 60 * 60 * 1000) }),
      NOW,
    )
    expect(s.state).toBe('VALID')
  })

  it('saat geri alma diğer her şeyden önce gelir (revoked makbuz olsa bile)', () => {
    const s = computeLicenseState(
      makeSnapshot({
        clockWatermark: daysFromNow(3),
        receipt: makeReceipt({ status: 'revoked' }),
      }),
      NOW,
    )
    expect(s.reasons).toEqual(['clock_tampering'])
  })
})

describe('computeLicenseState — makbuz/lisans eşleşmesi', () => {
  it('başka lisansın makbuzu YOK sayılır (çapa activatedAt olur)', () => {
    const s = computeLicenseState(
      makeSnapshot({
        receipt: makeReceipt({ licenseId: '99999999-9999-4999-8999-999999999999' }),
        activatedAt: daysFromNow(-2),
      }),
      NOW,
    )
    expect(s.state).toBe('VALID')
    expect(s.offlineDaysLeft).toBe(12)
  })

  it('başka lisansın REVOKED makbuzu bu lisansı kilitleyemez', () => {
    const s = computeLicenseState(
      makeSnapshot({
        receipt: makeReceipt({
          licenseId: '99999999-9999-4999-8999-999999999999',
          status: 'revoked',
        }),
        activatedAt: daysFromNow(-2),
      }),
      NOW,
    )
    expect(s.state).toBe('VALID')
  })
})
