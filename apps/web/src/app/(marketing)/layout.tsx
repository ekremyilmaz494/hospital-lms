import type { ReactNode } from 'react'
import { SiteShell } from '@/components/site/site-shell'

/**
 * İç pazarlama sayfalarının ortak kabuğu (ana sayfayla aynı üst bar + alt bilgi).
 * Sayfalar kendi header/footer'ını ve `<main>`'ini RENDER ETMEZ; kabuk `<main id="icerik">` verir.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
