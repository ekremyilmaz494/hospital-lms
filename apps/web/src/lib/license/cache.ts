import { isOnPrem } from '@/lib/deployment'
import { computeLicenseState, type LicenseState } from '@/lib/license/state'

/**
 * Lisans durumu için 60s in-memory cache — `authCache` deseninin lisans
 * karşılığı. Her istekte DB + imza doğrulaması yapmamak için; aktivasyon/
 * heartbeat sonrası `invalidateLicenseCache()` ile anında tazelenir.
 *
 * BULUT modunda kısa devre VALID döner: sıfır maliyet, sıfır davranış değişikliği.
 * (Bulutta erişim kontrolü mevcut abonelik/suspend katmanlarındadır.)
 *
 * Cache per-process'tir; on-prem compose paketi tek app konteyneri çalıştırır.
 * Çok replika senaryosunda 60s TTL bayatlığı sınırlar (dokümante).
 */

const CLOUD_VALID_STATE: LicenseState = {
  state: 'VALID',
  reasons: [],
  daysToExpiry: null,
  offlineDaysLeft: null,
  limits: null,
  customerName: null,
  licenseId: null,
}

const CACHE_TTL_MS = 60_000

let cached: { state: LicenseState; expiresAt: number } | null = null

/** Güncel lisans durumu (on-prem); bulutta her zaman VALID. */
export async function getLicenseState(): Promise<LicenseState> {
  if (!isOnPrem()) return CLOUD_VALID_STATE
  if (cached && cached.expiresAt > Date.now()) return cached.state

  // store (→ prisma) yalnız gerçekten on-prem'de yüklenir. Böylece enforcement/
  // api-handler'ı sadece IMPORT eden bulut testleri prisma'yı eager çekmez.
  const { loadLicenseSnapshot } = await import('@/lib/license/store')
  const snapshot = await loadLicenseSnapshot()
  const state = computeLicenseState(snapshot, new Date())
  cached = { state, expiresAt: Date.now() + CACHE_TTL_MS }
  return state
}

/** Aktivasyon/heartbeat/iptal sonrası ÇAĞRILMALI — 60s bayat-durum penceresini kapatır. */
export function invalidateLicenseCache(): void {
  cached = null
}
