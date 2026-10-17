/**
 * Site kabuğu (üst bar + alt bilgi) metinleri ve bağlantıları. TR + EN.
 * Yalnız VAR OLAN sayfalara/çapalara bağlanır; ikinci dalga sayfaları
 * (özellikler, çözümler, rehber) yayına girince eklenir.
 */
export type SiteLocale = 'tr' | 'en'

export interface SiteLink {
  href: string
  label: string
}

export const SITE_HOME: Record<SiteLocale, string> = { tr: '/', en: '/en' }

export const SITE_NAV: Record<SiteLocale, SiteLink[]> = {
  tr: [
    { href: '/#nasil-calisir', label: 'Nasıl çalışır' },
    { href: '/#denetim', label: 'Denetim' },
    { href: '/guvenlik', label: 'Güvenlik' },
    { href: '/sss', label: 'SSS' },
    { href: '/hakkimizda', label: 'Hakkımızda' },
  ],
  en: [
    { href: '/en#product', label: 'Product' },
    { href: '/en#proof', label: 'Audit evidence' },
    { href: '/en#about', label: 'About' },
    { href: '/en#contact', label: 'Contact' },
  ],
}

export const SITE_COPY = {
  tr: {
    login: 'Giriş Yap',
    demo: 'Demo Talep Edin',
    menu: 'Menü',
    home: 'KlinoVax ana sayfa',
    primaryNav: 'Ana menü',
    skip: 'İçeriğe geç',
    footerTagline: 'Hastaneler için personel eğitim ve sınav platformu.',
    founded: 'Kuruluş',
    cookieSettings: 'Çerez tercihleri',
    columns: [
      {
        title: 'Ürün',
        links: [
          { href: '/#nasil-calisir', label: 'Nasıl çalışır' },
          { href: '/#denetim', label: 'Denetim belgeleri' },
          { href: '/guvenlik', label: 'Güvenlik' },
          { href: '/sss', label: 'Sık sorulan sorular' },
        ],
      },
      {
        title: 'Şirket',
        links: [
          { href: '/hakkimizda', label: 'Hakkımızda' },
          { href: '/demo', label: 'Demo talebi' },
          { href: '/iletisim', label: 'İletişim' },
        ],
      },
      {
        title: 'Yasal',
        links: [
          { href: '/kvkk', label: 'KVKK Aydınlatma Metni' },
          { href: '/privacy', label: 'Gizlilik Politikası' },
          { href: '/cerez-politikasi', label: 'Çerez Politikası' },
          { href: '/data-retention', label: 'Saklama ve İmha' },
          { href: '/terms', label: 'Kullanım Şartları' },
        ],
      },
    ],
  },
  en: {
    login: 'Sign in',
    demo: 'Request a demo',
    menu: 'Menu',
    home: 'KlinoVax home',
    primaryNav: 'Main menu',
    skip: 'Skip to content',
    footerTagline: 'Staff training and exam platform for hospitals.',
    founded: 'Founded',
    cookieSettings: 'Cookie settings',
    columns: [
      {
        title: 'Product',
        links: [
          { href: '/en#product', label: 'Product' },
          { href: '/en#proof', label: 'Audit evidence' },
        ],
      },
      {
        title: 'Company',
        links: [
          { href: '/en#about', label: 'About' },
          { href: '/en#contact', label: 'Contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { href: '/privacy', label: 'Privacy' },
          { href: '/terms', label: 'Terms' },
        ],
      },
    ],
  },
} as const satisfies Record<SiteLocale, unknown>
