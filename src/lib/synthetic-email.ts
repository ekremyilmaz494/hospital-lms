/**
 * Sentetik e-posta üretimi — personel e-posta adresi vermek istemediğinde
 * Supabase Auth'a hesap kaydı için arka planda kullanılır. UI'da hiçbir yerde
 * gösterilmez; `.invalid` TLD (RFC 6761) gerçek mesaj iletmez.
 */

const SYNTHETIC_DOMAIN = 'klinovax.invalid'

/** Sentetik adres üretir; hash uzunluğu 16 char ile sınırlanarak length kontrolü içinde tutulur. */
export function generateSyntheticEmail(tcHash: string): string {
  return `staff-${tcHash.slice(0, 16)}.invalid@${SYNTHETIC_DOMAIN}`
}

/** Bir e-posta adresi sentetik mi (UI'dan gizlenmesi gerekir mi)? */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const lower = email.toLowerCase().trim()
  return lower.endsWith(`@${SYNTHETIC_DOMAIN}`) || /\.invalid$/.test(lower)
}
