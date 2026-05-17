/**
 * Brand single-source-of-truth — env'den geçersiz kılınabilir.
 * White-label / multi-sector kurulumlar için NEXT_PUBLIC_BRAND_* env'leri set edin.
 * Sektör-agnostik positioning (sağlık + üretim).
 */
const fromEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim()
  return value && value.length > 0 ? value : undefined
}

const supportEmail = fromEnv('SUPPORT_EMAIL') ?? 'destek@klinovax.com'

export const BRAND = {
  name: fromEnv('NEXT_PUBLIC_BRAND_NAME') ?? 'KlinoVax',
  fullName: fromEnv('NEXT_PUBLIC_BRAND_FULL_NAME') ?? 'KlinoVax Eğitim Platformu',
  shortDesc: fromEnv('NEXT_PUBLIC_BRAND_SHORT_DESC') ?? 'Klinik disiplinli kurumsal personel eğitim platformu',
  longDesc:
    fromEnv('NEXT_PUBLIC_BRAND_LONG_DESC') ??
    'Sağlıktan üretime, her sektör için klinik disiplinde personel eğitimi: atama, video, sınav, sertifika, KVKK & ISO 45001 uyum raporlaması — kurumunuza özel uçtan uca otomasyon.',
  domain: fromEnv('NEXT_PUBLIC_BRAND_DOMAIN') ?? 'klinovax.com',
  /** SES SendEmail "From" address — DKIM imzalı domain'den çıkmalı. */
  fromAddress: fromEnv('SES_FROM_EMAIL') ?? 'noreply@klinovax.com',
  supportEmail,
  contact: {
    email: supportEmail,
    phone: fromEnv('NEXT_PUBLIC_BRAND_PHONE') ?? '+90 850 000 0000',
    city: fromEnv('NEXT_PUBLIC_BRAND_CITY') ?? 'Ankara, Türkiye',
  },
  legal: {
    copyrightYear: new Date().getFullYear(),
  },
} as const

export const brand = BRAND
