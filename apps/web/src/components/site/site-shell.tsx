import type { ReactNode } from 'react'
import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
import { SiteReveal } from './site-reveal'
import type { SiteLocale } from './content/site-nav'
import '@/styles/site.css'

/**
 * Pazarlama sayfalarının ortak kabuğu: atlama bağlantısı, üst bar, `<main id="icerik">`,
 * alt bilgi ve görünürlük gözlemcisi. `/en` için `lang="en"` sarmalayıcıda verilir
 * (kök layout tek ve `lang="tr"`).
 */
export function SiteShell({ children, locale = 'tr' }: { children: ReactNode; locale?: SiteLocale }) {
  return (
    <div className="s-site" lang={locale === 'en' ? 'en' : undefined}>
      <SiteHeader locale={locale} />
      <main id="icerik" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter locale={locale} />
      <SiteReveal />
    </div>
  )
}
