import { describe, it, expect } from 'vitest'
import { KVKK_NOTICE_VERSION, isKvkkNoticeCurrent } from '../notice-version'

// Bu test, 2026-07 canlı olayının kök nedenini kilitler: middleware guard'ı ile
// login sayfasının modal-tetiği "KVKK onayı güncel mi" sorusunu FARKLI hesaplarsa
// (biri sürüm-duyarlı, diğeri yalnız onay-tarihi-dolu-mu) v1 onaylı kullanıcı
// login ⇄ dashboard sonsuz döngüsüne girer. Tek kaynak isKvkkNoticeCurrent bunu önler.
describe('isKvkkNoticeCurrent', () => {
  const ACK = '2026-01-01T00:00:00.000Z'

  it('güncel sürümü (v2) onaylamış kullanıcı → current', () => {
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: 2 })).toBe(true)
  })

  it('ESKİ sürümü (v1) onaylamış kullanıcı → NOT current (yeniden onay gerek)', () => {
    // Canlı olayın tam senaryosu: onay tarihi dolu ama sürüm eski.
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: 1 })).toBe(false)
  })

  it('sürüm alanı YOK ama onaylı (versiyonlama öncesi) → v1 grandfather → NOT current', () => {
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK })).toBe(false)
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: null })).toBe(false)
  })

  it('onay tarihi YOK → hiçbir sürümle current değil', () => {
    expect(isKvkkNoticeCurrent({})).toBe(false)
    expect(isKvkkNoticeCurrent({ kvkk_notice_version: 2 })).toBe(false)
    expect(isKvkkNoticeCurrent(null)).toBe(false)
    expect(isKvkkNoticeCurrent(undefined)).toBe(false)
  })

  it('sürüm string olarak gelse de sayısal karşılaştırılır', () => {
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: '2' })).toBe(true)
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: '1' })).toBe(false)
  })

  it('bozuk sürüm değeri (NaN) → current değil (fail-closed)', () => {
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: 'abc' })).toBe(false)
  })

  it('güncel sürümün ilerisini onaylamış (v3) → current', () => {
    expect(isKvkkNoticeCurrent({ kvkk_notice_acknowledged_at: ACK, kvkk_notice_version: KVKK_NOTICE_VERSION + 1 })).toBe(true)
  })
})
