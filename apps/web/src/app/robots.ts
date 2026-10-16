import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-metadata'

// `disallow` yalnız HİÇ indekslenmemesi gereken, taranması boşa olan alanlar içindir.
// Login/kayıt/davet gibi sayfalar `noindex` ile düşürülür: engellenen URL'deki
// noindex'i Google göremez. Kurum alt alan adları proxy'de `X-Robots-Tag: noindex` alır.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/super-admin/',
          '/staff/',
          '/group/',
          '/exam/',
          '/dev-reset',
          '/clear-cache',
          '/monitoring',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
