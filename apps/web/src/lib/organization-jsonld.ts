import { BRAND } from '@/lib/brand'

/** Vergi levhasındaki işe başlama tarihi (ISO). Site / LinkedIn / başvurularda aynı olmalı. */
export const FOUNDING_DATE = '2026-07-08'

type Locale = 'tr' | 'en'
type JsonLdNode = Record<string, unknown>

const SITE = `https://${BRAND.domain}`

/** Sayfalar arası aynı varlığı işaret eden sabit kimlikler (`@id`). */
export const JSONLD_IDS = {
  organization: `${SITE}/#organization`,
  website: `${SITE}/#website`,
  software: `${SITE}/#software`,
} as const

const COPY = {
  tr: {
    org: 'Hastaneler için personel eğitim ve sınav platformu.',
    app: 'Hastane personeli için zorunlu eğitim atama, ileri sarılamayan video, ön ve son sınav, QR ile doğrulanan sertifika ve denetim raporları.',
    features: [
      'Departman ve unvana göre eğitim atama',
      'İleri sarılamayan eğitim videosu',
      'Ön sınav ve son sınav',
      'QR kod ile doğrulanabilen PDF sertifika',
      'Eğitim katılım ve imza formları (PDF)',
      'Otomatik hatırlatma ve gecikme uyarısı',
      'iOS ve Android mobil uygulama',
    ],
  },
  en: {
    org: 'Staff training and exam platform for hospitals.',
    app: 'Mandatory training assignment, non-skippable video, pre and post exams, QR-verifiable certificates and audit reports for hospital staff.',
    features: [
      'Training assignment by department and title',
      'Non-skippable training video',
      'Pre-exam and post-exam',
      'QR-verifiable PDF certificate',
      'Training attendance and signature forms (PDF)',
      'Automatic reminders and overdue alerts',
      'iOS and Android mobile app',
    ],
  },
} as const

function organizationNode(locale: Locale): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': JSONLD_IDS.organization,
    name: BRAND.name,
    legalName: BRAND.legal.businessName,
    url: SITE,
    logo: { '@type': 'ImageObject', url: `${SITE}/apple-touch-icon.png`, width: 180, height: 180 },
    email: BRAND.contact.email,
    description: COPY[locale].org,
    foundingDate: FOUNDING_DATE,
    // Yalnız şehir/ülke: açık adres ASLA eklenmez.
    address: { '@type': 'PostalAddress', addressLocality: 'Konya', addressCountry: 'TR' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: BRAND.contact.email,
      areaServed: 'TR',
      availableLanguage: ['tr', 'en'],
    },
    founder: {
      '@type': 'Person',
      name: BRAND.founder.name,
      jobTitle: 'Founder',
      image: `${SITE}${BRAND.founder.photo}`,
      ...(BRAND.founder.linkedin ? { sameAs: [BRAND.founder.linkedin] } : {}),
    },
  }
}

function websiteNode(locale: Locale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': JSONLD_IDS.website,
    url: SITE,
    name: BRAND.name,
    inLanguage: locale === 'en' ? 'en' : 'tr-TR',
    publisher: { '@id': JSONLD_IDS.organization },
  }
}

/**
 * Ürün varlığı. Fiyat ve puan YOK (uydurulmaz); bu yüzden zengin sonuç beklenmez,
 * amaç arama motoruna "bu site bir yazılım ürünü sunuyor" bilgisini vermek.
 */
function softwareNode(locale: Locale): JsonLdNode {
  return {
    '@type': 'SoftwareApplication',
    '@id': JSONLD_IDS.software,
    name: BRAND.name,
    url: locale === 'en' ? `${SITE}/en` : SITE,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Learning management system',
    operatingSystem: 'Web, iOS, Android',
    inLanguage: locale === 'en' ? 'en' : 'tr-TR',
    description: COPY[locale].app,
    featureList: COPY[locale].features,
    publisher: { '@id': JSONLD_IDS.organization },
    sameAs: [BRAND.app.appStore, BRAND.app.googlePlay],
  }
}

// `</script>` enjeksiyonuna karşı JSON içinde `<` kaçışlanır.
function serialize(graph: JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}

/**
 * Şirket künyesi grafiği (Organization + WebSite): iç sayfalar ve /hakkimizda için.
 * Yalnız kamuya açık bilgiler: TC/VKN/açık adres ASLA eklenmez.
 *
 * @param locale - açıklama dili
 * @returns `<script type="application/ld+json">` içine gömülecek, `<` kaçışlı JSON string
 */
export function organizationJsonLd(locale: Locale = 'tr'): string {
  return serialize([organizationNode(locale), websiteNode(locale)])
}

/**
 * Ana sayfa grafiği: Organization + WebSite + SoftwareApplication (`/` ve `/en`).
 *
 * @param locale - açıklama ve özellik listesi dili
 */
export function homeJsonLd(locale: Locale = 'tr'): string {
  return serialize([organizationNode(locale), websiteNode(locale), softwareNode(locale)])
}

/**
 * İç sayfa için BreadcrumbList. İlk öğe her zaman ana sayfadır.
 *
 * @param trail - ana sayfadan sonraki adımlar, örn. `[{ name: 'Güvenlik', path: '/guvenlik' }]`
 */
export function breadcrumbJsonLd(trail: ReadonlyArray<{ name: string; path: string }>): string {
  const items = [{ name: 'Ana sayfa', path: '/' }, ...trail]
  return serialize([
    {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.path === '/' ? `${SITE}/` : `${SITE}${item.path}`,
      })),
    },
  ])
}
