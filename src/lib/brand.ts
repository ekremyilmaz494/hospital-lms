/**
 * Brand single-source-of-truth — env'den geçersiz kılınabilir.
 * White-label / multi-sector kurulumlar için NEXT_PUBLIC_BRAND_* env'leri set edin.
 */
const fromEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim()
  return value && value.length > 0 ? value : undefined
}

export const BRAND = {
  name: fromEnv('NEXT_PUBLIC_BRAND_NAME') ?? 'KlinoVax',
  fullName: fromEnv('NEXT_PUBLIC_BRAND_FULL_NAME') ?? 'KlinoVax Operasyon Platformu',
  shortDesc: fromEnv('NEXT_PUBLIC_BRAND_SHORT_DESC') ?? 'Sağlık kurumları için operasyon platformu',
  longDesc:
    fromEnv('NEXT_PUBLIC_BRAND_LONG_DESC') ??
    'Personel eğitiminden sertifika doğrulamaya, performans raporlamasından KVKK uyumuna — sağlık kurumlarınız için uçtan uca otomasyon.',
  domain: fromEnv('NEXT_PUBLIC_BRAND_DOMAIN') ?? 'klinovax.com',
  /** SES SendEmail "From" address — DKIM imzalı domain'den çıkmalı. */
  fromAddress: fromEnv('SES_FROM_EMAIL') ?? 'noreply@klinovax.com',
  supportEmail: fromEnv('SUPPORT_EMAIL') ?? 'destek@klinovax.com',
  contact: {
    email: fromEnv('SUPPORT_EMAIL') ?? 'iletisim@klinovax.com',
    phone: fromEnv('NEXT_PUBLIC_BRAND_PHONE') ?? '+90 850 000 0000',
    city: fromEnv('NEXT_PUBLIC_BRAND_CITY') ?? 'Ankara, Türkiye',
  },
  legal: {
    copyrightYear: new Date().getFullYear(),
  },
} as const

export const brand = BRAND
