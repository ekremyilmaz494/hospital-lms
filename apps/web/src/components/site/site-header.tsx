import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { BrandMark } from './brand-mark'
import { SITE_COPY, SITE_HOME, SITE_NAV, type SiteLocale } from './content/site-nav'

/**
 * Site üst barı. Server Component; mobil menü yerel `<details>` ile açılır
 * (JS'siz çalışır, klavye ve ekran okuyucu desteği tarayıcıdan gelir).
 * "Demo Talep Edin" her genişlikte görünür.
 */
export function SiteHeader({ locale = 'tr' }: { locale?: SiteLocale }) {
  const copy = SITE_COPY[locale]
  const nav = SITE_NAV[locale]

  return (
    <header className="s-header">
      <a href="#icerik" className="s-skip">
        {copy.skip}
      </a>
      <div className="s-header-inner">
        <Link href={SITE_HOME[locale]} className="s-logo" aria-label={copy.home}>
          <BrandMark size={30} />
          <span className="s-logo-word">{BRAND.name}</span>
        </Link>

        <nav className="s-nav" aria-label={copy.primaryNav}>
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="s-header-actions">
          <Link href="/auth/login" className="s-link-quiet s-hide-sm">
            {copy.login}
          </Link>
          <Link href="/demo" className="s-btn s-btn-primary s-btn-sm">
            {copy.demo}
          </Link>
          <details className="s-menu">
            <summary className="s-menu-btn" aria-label={copy.menu}>
              <span aria-hidden="true" className="s-menu-icon" />
            </summary>
            <div className="s-menu-panel">
              <ul>
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/auth/login">{copy.login}</Link>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
