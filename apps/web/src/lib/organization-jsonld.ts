import { BRAND } from '@/lib/brand'

/** Vergi levhasındaki işe başlama tarihi (ISO). Site / LinkedIn / başvurularda aynı olmalı. */
export const FOUNDING_DATE = '2026-07-08'

/**
 * schema.org `Organization` JSON-LD'si — şirket doğrulaması (arama motorları,
 * startup programı incelemeleri) için makine-okunur künye.
 *
 * Yalnız kamuya açık bilgiler: ad, alan adı, kuruluş tarihi/şehri, kurucu,
 * kurumsal e-posta. TC/VKN/açık adres ASLA eklenmez.
 *
 * @param locale - `description` dili
 * @returns `<script type="application/ld+json">` içine gömülecek, `<` kaçışlı JSON string
 */
export function organizationJsonLd(locale: 'tr' | 'en' = 'tr'): string {
  const url = `https://${BRAND.domain}`
  const description =
    locale === 'en'
      ? 'Staff training and compliance platform for hospitals, clinics and pharmacies.'
      : 'Hastane, klinik ve eczaneler için personel eğitim ve uyum platformu.'

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url,
    logo: `${url}/apple-touch-icon.png`,
    email: BRAND.contact.email,
    description,
    foundingDate: FOUNDING_DATE,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Konya',
      addressCountry: 'TR',
    },
    founder: {
      '@type': 'Person',
      name: BRAND.founder.name,
      jobTitle: 'Founder',
      image: `${url}${BRAND.founder.photo}`,
      ...(BRAND.founder.linkedin ? { sameAs: [BRAND.founder.linkedin] } : {}),
    },
  }

  // `</script>` enjeksiyonuna karşı — JSON içinde `<` kaçışlanır.
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
