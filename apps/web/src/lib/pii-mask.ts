/**
 * KVKK — loglara/hata izlemeye düz metin kişisel veri (e-posta, telefon, IP) yazmamak için
 * maskeleme yardımcıları. Debug için ayırt edici kısmı bırakır, kimliği gizler.
 *
 * Kullanım: `logger.info('auth', 'giriş denemesi', { email: maskEmail(email), ip: maskIp(ip) })`
 * Not: TC Kimlik / sağlık verisi loglara HİÇ yazılmamalı (maskeleme değil, tamamen dışarıda bırak).
 */

/** `ahmet@hastane.com` → `ah***@hastane.com`. Yerel kısmı maskeler, domaini (tenant teşhisi) korur. */
export function maskEmail(email?: string | null): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`
}

/** `0553 953 06 96` → `***0696`. Yalnız son 4 haneyi bırakır (sms-otp deseni). */
export function maskPhone(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? `***${digits.slice(-4)}` : '***'
}

/** `85.100.23.47` → `85.100.23.x` (IPv4 son oktet); IPv6 son grubu gizler. Alt-ağ debug'ı için üst kısım kalır. */
export function maskIp(ip?: string | null): string {
  if (!ip) return ''
  const first = ip.split(',')[0].trim() // x-forwarded-for zinciri → ilk (istemci) IP
  if (first.includes('.')) {
    const parts = first.split('.')
    if (parts.length === 4) {
      parts[3] = 'x'
      return parts.join('.')
    }
  }
  if (first.includes(':')) {
    const parts = first.split(':')
    parts[parts.length - 1] = 'x'
    return parts.join(':')
  }
  return '***'
}
