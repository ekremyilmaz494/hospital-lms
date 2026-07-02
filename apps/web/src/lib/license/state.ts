import type { LicenseClaims, ReceiptClaims } from '@/lib/license/schema'

/**
 * Lisans durum makinesi — SAF fonksiyon (I/O yok, saat parametreyle gelir).
 *
 * Durumlar ve kademeli kilit:
 *   NO_LICENSE → hiç lisans yok / imza geçersiz (aktivasyon ekranı)
 *   VALID      → tam çalışma
 *   WARN       → bitişe ≤30 gün VEYA offline grace'in yarısı tükendi (banner)
 *   READONLY   → bitiş tarihi geçti, +7 gün (okuma serbest, yazma kilitli)
 *   LOCKED     → iptal / bitiş+7g / offline grace aşıldı / saat geri alındı
 *
 * Zaman kaynakları:
 *   - now: sistem saati
 *   - clockWatermark: görülen en ileri zaman (makbuz iat'i ile ileri sarar) —
 *     now < watermark − 24h ise saat geri alınmış demektir → LOCKED.
 *   - Offline grace çapası: son geçerli makbuzun iat'i; hiç makbuz yoksa
 *     activatedAt. Yani kurulum internetsiz de olsa graceDays kadar çalışır.
 */

export type LicenseStateName = 'NO_LICENSE' | 'VALID' | 'WARN' | 'READONLY' | 'LOCKED'

export type LicenseStateReason =
  | 'no_license'
  | 'signature_invalid'
  | 'revoked'
  | 'expired'
  | 'expiring_soon'
  | 'offline_grace_exceeded'
  | 'offline_warning'
  | 'clock_tampering'

export interface LicenseSnapshot {
  /** Doğrulanmış lisans claim'leri; yoksa/imza düşmüşse null. */
  claims: LicenseClaims | null
  /** İmza düştüğü İÇİN mi null olduğu bilgisi (mesaj ayrımı için). */
  signatureInvalid?: boolean
  /** Doğrulanmış son makbuz (süresi geçmiş olabilir); yoksa null. */
  receipt: ReceiptClaims | null
  activatedAt: Date | null
  clockWatermark: Date | null
}

export interface LicenseState {
  state: LicenseStateName
  reasons: LicenseStateReason[]
  /** Bitişe kalan gün (negatif = geçti); süresiz lisansta null. */
  daysToExpiry: number | null
  /** Online doğrulama yapılmadan kalan gün; lisans yokken null. */
  offlineDaysLeft: number | null
  limits: LicenseClaims['limits'] | null
  customerName: string | null
  licenseId: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Bitişten sonra salt-okunur çalışılan pencere. */
export const READONLY_GRACE_DAYS = 7
/** Bitişe bu kadar gün kala uyarı başlar. */
export const EXPIRY_WARN_DAYS = 30
/** Saat geri alma toleransı (NTP kayması, saat dilimi düzeltmesi vb. için). */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 24 * 60 * 60 * 1000

function buildState(
  base: Pick<LicenseState, 'state' | 'reasons'>,
  claims: LicenseClaims | null,
  daysToExpiry: number | null,
  offlineDaysLeft: number | null,
): LicenseState {
  return {
    ...base,
    daysToExpiry,
    offlineDaysLeft,
    limits: claims?.limits ?? null,
    customerName: claims?.customerName ?? null,
    licenseId: claims?.jti ?? null,
  }
}

/** Lisans durumunu hesaplar. Kilit nedenleri öncelik sırasıyla değerlendirilir. */
export function computeLicenseState(snapshot: LicenseSnapshot, now: Date): LicenseState {
  const { claims, receipt, activatedAt, clockWatermark } = snapshot

  if (!claims) {
    return buildState(
      {
        state: 'NO_LICENSE',
        reasons: [snapshot.signatureInvalid ? 'signature_invalid' : 'no_license'],
      },
      null,
      null,
      null,
    )
  }

  // Makbuz başka bir lisansa aitse (yenileme sonrası eski makbuz) yok sayılır.
  const matchingReceipt =
    receipt && receipt.licenseId === claims.jti ? receipt : null

  // ── Zaman hesapları ──
  const validUntilMs = claims.validUntil ? Date.parse(claims.validUntil) : null
  const daysToExpiry =
    validUntilMs !== null ? Math.ceil((validUntilMs - now.getTime()) / DAY_MS) : null

  // Offline grace çapası: son makbuz > aktivasyon. Çapa yoksa (hiç aktive
  // edilmemiş satır — normalde olmaz) fail-closed: grace tükenmiş sayılır.
  const anchorMs = matchingReceipt
    ? matchingReceipt.iat * 1000
    : activatedAt?.getTime() ?? null
  const offlineDays = anchorMs !== null ? (now.getTime() - anchorMs) / DAY_MS : Infinity
  const offlineDaysLeft = Number.isFinite(offlineDays)
    ? Math.max(0, Math.ceil(claims.graceDays - offlineDays))
    : 0

  // ── LOCKED kontrolleri (öncelik sırasıyla) ──
  // 1) Saat geri alınmış — diğer tüm zaman hesapları güvenilmez.
  if (
    clockWatermark &&
    now.getTime() < clockWatermark.getTime() - CLOCK_ROLLBACK_TOLERANCE_MS
  ) {
    return buildState(
      { state: 'LOCKED', reasons: ['clock_tampering'] },
      claims,
      daysToExpiry,
      offlineDaysLeft,
    )
  }

  // 2) Uzaktan iptal (makbuz revoked diyor).
  if (matchingReceipt?.status === 'revoked') {
    return buildState(
      { state: 'LOCKED', reasons: ['revoked'] },
      claims,
      daysToExpiry,
      offlineDaysLeft,
    )
  }

  // 3) Bitiş + salt-okunur pencere de geçti.
  if (daysToExpiry !== null && daysToExpiry <= -READONLY_GRACE_DAYS) {
    return buildState(
      { state: 'LOCKED', reasons: ['expired'] },
      claims,
      daysToExpiry,
      offlineDaysLeft,
    )
  }

  // 4) Offline tolerans aşıldı (online doğrulama çok uzun süredir yok).
  if (offlineDays > claims.graceDays) {
    return buildState(
      { state: 'LOCKED', reasons: ['offline_grace_exceeded'] },
      claims,
      daysToExpiry,
      offlineDaysLeft,
    )
  }

  // ── READONLY: bitiş geçti, salt-okunur pencere içindeyiz ──
  if (daysToExpiry !== null && daysToExpiry <= 0) {
    return buildState(
      { state: 'READONLY', reasons: ['expired'] },
      claims,
      daysToExpiry,
      offlineDaysLeft,
    )
  }

  // ── WARN: yaklaşan bitiş ve/veya offline grace yarıyı geçti ──
  const reasons: LicenseStateReason[] = []
  if (daysToExpiry !== null && daysToExpiry <= EXPIRY_WARN_DAYS) {
    reasons.push('expiring_soon')
  }
  if (offlineDays > claims.graceDays / 2) {
    reasons.push('offline_warning')
  }
  if (reasons.length > 0) {
    return buildState({ state: 'WARN', reasons }, claims, daysToExpiry, offlineDaysLeft)
  }

  return buildState({ state: 'VALID', reasons: [] }, claims, daysToExpiry, offlineDaysLeft)
}
