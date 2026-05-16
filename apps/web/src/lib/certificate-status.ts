/**
 * Sertifika durumu için tek doğruluk kaynağı.
 * API (admin/certificates) ve client hook (use-cert-filters) aynı eşiği
 * ve aynı türetme mantığını buradan okur.
 */

export const EXPIRING_SOON_DAYS = 30
export const MS_PER_DAY = 86_400_000

export interface CertLike {
  expiresAt: Date | string | null
  revokedAt: Date | string | null
}

export interface CertStatus {
  isRevoked: boolean
  isExpired: boolean
  isActive: boolean
  isExpiringSoon: boolean
  daysUntilExpiry: number | null
}

export interface CertStats {
  totalCerts: number
  activeCerts: number
  expiredCerts: number
  revokedCerts: number
  expiringSoon: number
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

export function daysUntilExpiry(expiresAt: Date | string | null, now: Date = new Date()): number | null {
  const d = toDate(expiresAt)
  if (!d) return null
  return Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY)
}

export function getCertificateStatus(c: CertLike, now: Date = new Date()): CertStatus {
  const isRevoked = !!c.revokedAt
  const expiresAt = toDate(c.expiresAt)
  const isExpired = !isRevoked && !!expiresAt && expiresAt < now
  const isActive = !isRevoked && !isExpired
  const days = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY) : null
  const isExpiringSoon = isActive && days !== null && days > 0 && days <= EXPIRING_SOON_DAYS
  return { isRevoked, isExpired, isActive, isExpiringSoon, daysUntilExpiry: days }
}

export function computeCertificateStats(certs: CertLike[], now: Date = new Date()): CertStats {
  let activeCerts = 0
  let expiredCerts = 0
  let revokedCerts = 0
  let expiringSoon = 0
  for (const c of certs) {
    const s = getCertificateStatus(c, now)
    if (s.isRevoked) revokedCerts++
    else if (s.isExpired) expiredCerts++
    else activeCerts++
    if (s.isExpiringSoon) expiringSoon++
  }
  return { totalCerts: certs.length, activeCerts, expiredCerts, revokedCerts, expiringSoon }
}
