import type { MetadataRoute } from 'next'
import { getIndexablePaths } from '@/lib/site-routes'
import { SITE_URL } from '@/lib/site-metadata'

// Sayfa içeriği son anlamlı değiştiğinde güncellenir. `new Date()` her build'de
// tarihi yeniler; arama motorları bu sinyale güvenmeyi bırakır.
const LAST_MODIFIED: Record<string, string> = {
  '/': '2026-10-17',
  '/en': '2026-10-17',
  '/hakkimizda': '2026-10-10',
  '/demo': '2026-10-17',
  '/iletisim': '2026-10-17',
  '/sss': '2026-10-17',
  '/guvenlik': '2026-10-17',
  '/kvkk': '2026-07-08',
  '/privacy': '2026-07-08',
  '/terms': '2026-07-08',
  '/cerez-politikasi': '2026-07-08',
  '/data-retention': '2026-07-08',
}

const PRIORITY: Record<string, number> = { '/': 1, '/demo': 0.9, '/en': 0.8, '/hakkimizda': 0.7, '/guvenlik': 0.7, '/sss': 0.6, '/iletisim': 0.6 }

/** Yalnız gerçek dil karşılığı olan sayfa çifti. */
const HOME_PAIR = { tr: `${SITE_URL}/`, en: `${SITE_URL}/en`, 'x-default': `${SITE_URL}/` }
const LANGUAGE_PAIRS: Record<string, Record<string, string>> = { '/': HOME_PAIR, '/en': HOME_PAIR }

export default function sitemap(): MetadataRoute.Sitemap {
  return getIndexablePaths().map((path) => ({
    url: path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    ...(LAST_MODIFIED[path] && { lastModified: LAST_MODIFIED[path] }),
    priority: PRIORITY[path] ?? 0.3,
    ...(LANGUAGE_PAIRS[path] && { alternates: { languages: LANGUAGE_PAIRS[path] } }),
  }))
}
