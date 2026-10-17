/**
 * Landing (pazarlama) sayfaları için hafif TR/EN metin sözlüğü.
 * Uygulama i18n'inden (`src/i18n`) bağımsız — yalnız header/footer/drawer metinleri.
 */
export type LandingLocale = 'tr' | 'en';

export interface LandingNavItem {
  href: string;
  label: string;
  desc: string;
  icon: 'training' | 'proof' | 'about' | 'contact' | 'flow' | 'security' | 'faq';
  /** 'both': masaüstü header + mobil drawer · 'drawer': yalnız mobil drawer. */
  placement: 'both' | 'drawer';
  /** 'secondary': dar masaüstünde (1025-1180px) header'dan gizlenir; header sığsın diye. */
  priority?: 'secondary';
}

export const LANDING_HOME: Record<LandingLocale, string> = { tr: '/', en: '/en' };

export const LANDING_NAV: Record<LandingLocale, LandingNavItem[]> = {
  tr: [
    {
      href: '/#egitim',
      label: 'Eğitim',
      desc: 'Eğitim ve sınav yönetimi',
      icon: 'training',
      placement: 'both',
    },
    {
      href: '/#kanit',
      label: 'Uyum',
      desc: 'Rapor, SKS belgesi, sertifika',
      icon: 'proof',
      placement: 'both',
    },
    {
      href: '/#nasil-calisir',
      label: 'Nasıl Çalışır',
      desc: 'Dört adımda kurulum ve takip',
      icon: 'flow',
      placement: 'drawer',
    },
    {
      href: '/guvenlik',
      label: 'Güvenlik',
      desc: 'Veri koruma ve erişim denetimi',
      icon: 'security',
      placement: 'both',
    },
    {
      href: '/#sss',
      label: 'SSS',
      desc: 'Sık sorulan sorular',
      icon: 'faq',
      placement: 'both',
      priority: 'secondary',
    },
    {
      href: '/hakkimizda',
      label: 'Hakkımızda',
      desc: 'Biz kimiz, kurucumuz',
      icon: 'about',
      placement: 'both',
    },
    {
      href: '/iletisim',
      label: 'İletişim',
      desc: 'Bize ulaşın',
      icon: 'contact',
      placement: 'both',
    },
  ],
  en: [
    {
      href: '/en#product',
      label: 'Product',
      desc: 'Training & exam platform',
      icon: 'training',
      placement: 'both',
    },
    {
      href: '/en#proof',
      label: 'Proof',
      desc: 'Certificates & audit reports',
      icon: 'proof',
      placement: 'both',
    },
    {
      href: '/en#about',
      label: 'About',
      desc: 'Who we are, founder',
      icon: 'about',
      placement: 'both',
    },
    {
      href: '/en#contact',
      label: 'Contact',
      desc: 'Get in touch',
      icon: 'contact',
      placement: 'both',
    },
  ],
};

export const LANDING_COPY = {
  tr: {
    login: 'Giriş Yap',
    demo: 'Demo Talep Edin',
    demoHref: '/demo',
    menu: 'MENÜ',
    openMenu: 'Menüyü aç',
    closeMenu: 'Menüyü kapat',
    mobileMenu: 'Mobil menü',
    drawerFoot: 'Sağlık kurumları için eğitim ve sınav platformu',
    langLabel: 'Dil seçimi',
    currentLang: 'geçerli dil',
    mainNav: 'Ana menü',
    footerNav: 'Alt bilgi bağlantıları',
    legalNav: 'Yasal bağlantılar',
  },
  en: {
    login: 'Sign in',
    demo: 'Request a demo',
    demoHref: '/en#contact',
    menu: 'MENU',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mobileMenu: 'Mobile menu',
    drawerFoot: 'Training and exam platform for healthcare organizations',
    langLabel: 'Language',
    currentLang: 'current language',
    mainNav: 'Main menu',
    footerNav: 'Footer links',
    legalNav: 'Legal',
  },
} as const satisfies Record<LandingLocale, Record<string, string>>;
