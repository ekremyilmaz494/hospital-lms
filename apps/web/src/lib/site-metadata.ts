import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

/**
 * Kanonik site kökü. `NEXT_PUBLIC_APP_URL` KULLANILMAZ: ortamdan ortama değişir
 * (önizleme, localhost) ve sitemap/canonical'a yanlış kök sızdırır.
 */
export const SITE_URL = `https://${BRAND.domain}`

/** Başlık şablonu kök layout'ta: `%s | KlinoVax`. Ana sayfa `absolute` kullanır. */
export const TITLE_TEMPLATE = `%s | ${BRAND.name}`

/** Google/Bing: başlık ≤60, açıklama ≤155 karakterde kesilmeden görünür. */
export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 155

type Locale = 'tr' | 'en'

const OG_LOCALE: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' }

/** `app/opengraph-image.tsx` boyutu (`OG_SIZE`); burada tekrar import edilmez, ImageResponse'u sayfa paketine çekmesin. */
const OG_IMAGE = { width: 1200, height: 630 }

export interface PageMetadataInput {
  /** Şablonla birleşecek kısa başlık (`%s`). `absoluteTitle` verilirse yok sayılır. */
  title: string
  description: string
  /** Kanonik yol, `/` ile başlar. */
  path: string
  locale?: Locale
  /** Şablonu atlayan tam başlık (ana sayfa, /en). */
  absoluteTitle?: boolean
  /**
   * Gerçek dil karşılığı olan sayfalar için hreflang. Karşılığı olmayan sayfaya
   * EKLEME: yanlış hreflang Google'ın iki sayfayı da yok saymasına yol açar.
   */
  languages?: Partial<Record<Locale | 'x-default', string>>
  /** Taranabilir ama indekslenmeyecek sayfalar (login, kayıt, lisans). */
  noindex?: boolean
}

/**
 * Pazarlama sayfaları için tutarlı metadata üretir: başlık, açıklama, canonical,
 * hreflang, Open Graph ve Twitter kartı.
 *
 * Next metadata'yı segmentler arasında SIĞ birleştirir; `openGraph` gibi iç içe
 * alanlar üst segmentten miras alınmaz, o yüzden her sayfa tam nesneyi bu
 * yardımcıdan alır. OG görseli dosya tabanlı (`app/opengraph-image.tsx`).
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, locale = 'tr', absoluteTitle = false, languages, noindex } = input
  const fullTitle = absoluteTitle ? title : TITLE_TEMPLATE.replace('%s', title)
  // Alt segmentte `openGraph` tanımlanınca kökteki dosya tabanlı görsel miras ALINMAZ
  // (build çıktısında doğrulandı) → görsel açıkça verilir. Aynı segmentte
  // opengraph-image dosyası olan sayfada (/ ve /en) dosya bunu ezer.
  const images = [{ url: locale === 'en' ? '/en/opengraph-image' : '/opengraph-image', ...OG_IMAGE }]

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
      ...(languages && { languages }),
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: BRAND.name,
      locale: OG_LOCALE[locale],
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images,
    },
    ...(noindex && { robots: { index: false, follow: true } }),
  }
}

/** `/` ↔ `/en` karşılıklı hreflang; `x-default` Türkçe ana sayfa. */
export const HOME_LANGUAGES = { tr: '/', en: '/en', 'x-default': '/' } as const
