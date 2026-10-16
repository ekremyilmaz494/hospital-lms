import { describe, expect, it } from 'vitest'
import { DESCRIPTION_MAX, HOME_LANGUAGES, pageMetadata, SITE_URL, TITLE_MAX, TITLE_TEMPLATE } from '../site-metadata'
import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { getIndexablePaths } from '../site-routes'

describe('pageMetadata', () => {
  it('şablon başlığı Next şablonuna bırakır, OG/Twitter başlığını tam üretir', () => {
    const m = pageMetadata({ title: 'İletişim', description: 'd', path: '/contact' })
    expect(m.title).toBe('İletişim')
    expect(m.openGraph?.title).toBe(TITLE_TEMPLATE.replace('%s', 'İletişim'))
    expect(m.alternates?.canonical).toBe('/contact')
    expect(m.robots).toBeUndefined()
  })

  it('absoluteTitle şablonu atlar', () => {
    const m = pageMetadata({ title: 'Tam Başlık', description: 'd', path: '/', absoluteTitle: true })
    expect(m.title).toEqual({ absolute: 'Tam Başlık' })
  })

  it('hreflang yalnız verildiğinde basılır', () => {
    expect(pageMetadata({ title: 't', description: 'd', path: '/kvkk' }).alternates?.languages).toBeUndefined()
    const home = pageMetadata({ title: 't', description: 'd', path: '/', languages: HOME_LANGUAGES })
    expect(home.alternates?.languages).toEqual({ tr: '/', en: '/en', 'x-default': '/' })
  })

  it('noindex sayfası takip edilebilir kalır', () => {
    expect(pageMetadata({ title: 't', description: 'd', path: '/x', noindex: true }).robots).toEqual({
      index: false,
      follow: true,
    })
  })
})

describe('yayındaki sayfa metadata sınırları', async () => {
  const pages = {
    '/': await import('@/app/page'),
    '/en': await import('@/app/en/page'),
    '/hakkimizda': await import('@/app/hakkimizda/page'),
    '/demo': await import('@/app/(marketing)/demo/page'),
    '/contact': await import('@/app/(marketing)/contact/page'),
    '/privacy': await import('@/app/(marketing)/privacy/page'),
    '/terms': await import('@/app/(marketing)/terms/page'),
    '/data-retention': await import('@/app/(marketing)/data-retention/page'),
    '/kvkk': await import('@/app/kvkk/page'),
    '/cerez-politikasi': await import('@/app/cerez-politikasi/page'),
  }

  it('indekslenen her sayfanın metadata testi var', () => {
    expect(Object.keys(pages).sort()).toEqual([...getIndexablePaths()].sort())
  })

  for (const [path, mod] of Object.entries(pages)) {
    it(`${path}: başlık ≤${TITLE_MAX}, açıklama ≤${DESCRIPTION_MAX}, canonical kendisi`, () => {
      const { metadata } = mod
      const title = metadata.openGraph?.title
      expect(typeof title).toBe('string')
      expect((title as string).length).toBeLessThanOrEqual(TITLE_MAX)
      expect(metadata.description?.length ?? 0).toBeGreaterThan(50)
      expect(metadata.description!.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
      expect(metadata.alternates?.canonical).toBe(path)
      // İddia politikası: "KVKK uyumlu" ve em-dash yok
      expect(`${title} ${metadata.description}`).not.toMatch(/KVKK uyumlu|—/)
    })
  }

  it('hreflang yalnız gerçek karşılığı olan / ve /en çiftinde', () => {
    for (const [path, mod] of Object.entries(pages)) {
      const languages = mod.metadata.alternates?.languages
      if (path === '/' || path === '/en') expect(languages).toEqual(HOME_LANGUAGES)
      else expect(languages).toBeUndefined()
    }
  })
})

describe('sitemap + robots', () => {
  it('sitemap indekslenebilir rotaları kanonik kökle listeler', () => {
    const entries = sitemap()
    expect(entries.map((e) => e.url)).toEqual(
      getIndexablePaths().map((p) => (p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p}`)),
    )
    for (const e of entries) expect(e.url.startsWith('https://')).toBe(true)
  })

  it('robots noindex sayfalarını engellemez (noindex görünsün)', () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const disallow = rules.flatMap((rule) => [rule.disallow ?? []].flat())
    for (const path of ['/auth/', '/register', '/davet/', '/license', '/offline']) {
      expect(disallow.some((d) => path.startsWith(d))).toBe(false)
    }
    for (const indexable of getIndexablePaths()) {
      expect(disallow.some((d) => indexable.startsWith(d))).toBe(false)
    }
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
