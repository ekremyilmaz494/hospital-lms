'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/landing-3d/header';
import { Footer } from '@/components/landing-3d/footer';

/**
 * Fixed header'ın altında kalmamak için içerik üst boşluğu. Değer CSS değişkeni olarak
 * dışarı açılır; kendi dekoratif katmanını ofsetlemesi gereken sayfalar (ör. /contact)
 * aynı değişkeni kullanır. INLINE style — harici CSS chunk'ına bağımlı değil (SSR ile gelir).
 */
const HEADER_OFFSET = 'clamp(116px, 9vw, 140px)';

/** Sayfa yoluna göre TR/EN seçicinin götüreceği karşılık sayfa. */
const ALTERNATE_HREF_BY_PATH: Record<string, string> = {
  '/contact': '/en#contact',
};
const DEFAULT_ALTERNATE_HREF = '/en';

/** Pazarlama sayfaları için ortak kabuk: landing-3d Header + içerik + Footer. */
export function MarketingLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const alternateHref = ALTERNATE_HREF_BY_PATH[pathname] ?? DEFAULT_ALTERNATE_HREF;

  return (
    <div
      className="l3d-page"
      style={
        {
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          '--marketing-header-offset': HEADER_OFFSET,
        } as React.CSSProperties
      }
    >
      <Header alternateHref={alternateHref} />
      <main style={{ flex: '1 0 auto', paddingTop: 'var(--marketing-header-offset)' }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
