/**
 * Brand single-source-of-truth — env'den geçersiz kılınabilir.
 * White-label / multi-sector kurulumlar için NEXT_PUBLIC_BRAND_* env'leri set edin.
 * Sektör-agnostik positioning (sağlık + üretim).
 */
const fromEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim()
  return value && value.length > 0 ? value : undefined
}

const supportEmail = fromEnv('SUPPORT_EMAIL') ?? 'ekremyilmaz@klinovax.info'

export const BRAND = {
  name: fromEnv('NEXT_PUBLIC_BRAND_NAME') ?? 'KlinoVax',
  fullName: fromEnv('NEXT_PUBLIC_BRAND_FULL_NAME') ?? 'KlinoVax Eğitim Platformu',
  shortDesc: fromEnv('NEXT_PUBLIC_BRAND_SHORT_DESC') ?? 'Sağlık kurumları için klinik disiplinli personel eğitim platformu',
  longDesc:
    fromEnv('NEXT_PUBLIC_BRAND_LONG_DESC') ??
    'Hastane, klinik ve eczaneler için klinik disiplinde personel eğitimi: atama, video, sınav, sertifika, KVKK uyum raporlaması — kurumunuza özel uçtan uca otomasyon.',
  domain: fromEnv('NEXT_PUBLIC_BRAND_DOMAIN') ?? 'klinovax.com',
  /** SES SendEmail "From" address — DKIM imzalı domain'den çıkmalı. */
  fromAddress: fromEnv('SES_FROM_EMAIL') ?? 'noreply@klinovax.com',
  supportEmail,
  contact: {
    email: supportEmail,
    phone: fromEnv('NEXT_PUBLIC_BRAND_PHONE') ?? '0553 953 06 96',
    city: fromEnv('NEXT_PUBLIC_BRAND_CITY') ?? 'Konya, Türkiye',
  },
  /** Mobil uygulama mağaza bağlantıları — env ile override edilebilir (white-label). */
  app: {
    appStore:
      fromEnv('NEXT_PUBLIC_APP_STORE_URL') ?? 'https://apps.apple.com/tr/app/id6782176973',
    googlePlay:
      fromEnv('NEXT_PUBLIC_GOOGLE_PLAY_URL') ??
      'https://play.google.com/store/apps/details?id=com.klinovax.app',
  },
  legal: {
    copyrightYear: new Date().getFullYear(),
  },
} as const

export const brand = BRAND
