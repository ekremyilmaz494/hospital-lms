/**
 * Landing (pazarlama) sayfaları için hafif TR/EN metin sözlüğü.
 * Uygulama i18n'inden (`src/i18n`) bağımsız — yalnız header/footer/drawer metinleri.
 */
export type LandingLocale = 'tr' | 'en';

export interface LandingNavItem {
  href: string;
  label: string;
  desc: string;
  icon: 'training' | 'proof' | 'about' | 'contact';
}

export const LANDING_HOME: Record<LandingLocale, string> = { tr: '/', en: '/en' };

export const LANDING_NAV: Record<LandingLocale, LandingNavItem[]> = {
  tr: [
    { href: '/#egitim', label: 'Eğitim', desc: 'Eğitim & sınav yönetimi', icon: 'training' },
    { href: '/#kanit', label: 'Kanıt', desc: 'Sertifika & denetim raporu', icon: 'proof' },
    { href: '/hakkimizda', label: 'Hakkımızda', desc: 'Biz kimiz, kurucu', icon: 'about' },
    { href: '/contact', label: 'İletişim', desc: 'Bize ulaşın', icon: 'contact' },
  ],
  en: [
    { href: '/en#product', label: 'Product', desc: 'Training & exam platform', icon: 'training' },
    { href: '/en#proof', label: 'Proof', desc: 'Certificates & audit reports', icon: 'proof' },
    { href: '/en#about', label: 'About', desc: 'Who we are, founder', icon: 'about' },
    { href: '/en#contact', label: 'Contact', desc: 'Get in touch', icon: 'contact' },
  ],
};

export const LANDING_COPY = {
  tr: {
    login: 'Giriş Yap',
    demo: 'Demo Talep Et',
    menu: 'MENÜ',
    openMenu: 'Menüyü aç',
    closeMenu: 'Menüyü kapat',
    mobileMenu: 'Mobil menü',
    drawerFoot: 'Hastaneler için eğitim & sınav platformu',
    langLabel: 'Dil seçimi',
  },
  en: {
    login: 'Sign in',
    demo: 'Request a demo',
    menu: 'MENU',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mobileMenu: 'Mobile menu',
    drawerFoot: 'Training & exam platform for hospitals',
    langLabel: 'Language',
  },
} as const satisfies Record<LandingLocale, Record<string, string>>;
