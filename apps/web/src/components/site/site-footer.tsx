import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { BrandMark } from './brand-mark'
import { StoreBadges } from './store-badges'
import { SITE_COPY, type SiteLocale } from './content/site-nav'

/**
 * Site alt bilgisi: marka + sütunlu bağlantılar + işletme künyesi.
 * Senkron kalmalı (testler renderToStaticMarkup ile render eder).
 * Künye vergi levhasıyla birebir; TC/VKN/açık adres YAZILMAZ.
 */
export function SiteFooter({ locale = 'tr' }: { locale?: SiteLocale }) {
  const copy = SITE_COPY[locale]
  const { legal, contact, founder } = BRAND

  return (
    <footer className="s-footer">
      <div className="s-container s-footer-grid">
        <div className="s-footer-brand">
          <span className="s-logo">
            <BrandMark size={28} />
            <span className="s-logo-word">{BRAND.name}</span>
          </span>
          <p>{copy.footerTagline}</p>
          <StoreBadges compact />
        </div>

        {copy.columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="s-footer-col">
            <h2>{col.title}</h2>
            <ul>
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="s-container s-footer-legal">
        <span>
          © {legal.copyrightYear} {BRAND.name} · {legal.businessName}
        </span>
        <span>
          {contact.city} · {copy.founded}: {legal.foundedYear} ·{' '}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          {founder.linkedin && (
            <>
              {' · '}
              <a href={founder.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </>
          )}
        </span>
      </div>
    </footer>
  )
}
