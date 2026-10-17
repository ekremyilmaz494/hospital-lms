import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import type { SiteLocale } from './content/site-nav'
import './about.css'

const COPY = {
  tr: { role: 'Kurucu', linkedin: 'LinkedIn profilini açın', alt: `${BRAND.founder.name}, ${BRAND.name} kurucusu` },
  en: { role: 'Founder', linkedin: 'View LinkedIn profile', alt: `${BRAND.founder.name}, founder of ${BRAND.name}` },
} as const satisfies Record<SiteLocale, unknown>

/**
 * Kurucu kartı: fotoğraf, ad, unvan ve LinkedIn bağlantısı. /hakkimizda ve /en paylaşır.
 * Kimlik bilgisi yalnız `BRAND`'den gelir.
 */
export function FounderCard({ locale = 'tr' }: { locale?: SiteLocale }) {
  const copy = COPY[locale]
  const { founder } = BRAND

  return (
    <figure className="s-card s-founder">
      <Image
        src={founder.photo}
        alt={copy.alt}
        width={360}
        height={360}
        sizes="(max-width: 860px) 90vw, 360px"
        className="s-founder-photo"
      />
      <figcaption className="s-founder-body">
        <span className="s-founder-name">{founder.name}</span>
        <span className="s-founder-role">{`${copy.role}, ${BRAND.name}`}</span>
        {founder.linkedin && (
          <a href={founder.linkedin} target="_blank" rel="noopener noreferrer" className="s-founder-link">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
            </svg>
            {copy.linkedin}
          </a>
        )}
      </figcaption>
    </figure>
  )
}
