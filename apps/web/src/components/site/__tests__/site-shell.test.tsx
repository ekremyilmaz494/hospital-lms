import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteFooter } from '../site-footer'
import { SiteHeader } from '../site-header'
import { BRAND } from '@/lib/brand'
import { HOME_TR } from '../content/home.tr'

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ')

describe('SiteFooter: işletme künyesi', () => {
  it('TR: işletme adı, kuruluş yılı, şehir, kurumsal e-posta ve yasal sayfalar', () => {
    const html = renderToStaticMarkup(<SiteFooter />)
    expect(html).toContain(BRAND.legal.businessName)
    expect(html).toContain(`Kuruluş: ${BRAND.legal.foundedYear}`)
    expect(html).toContain('Konya, Türkiye')
    expect(html).toContain('mailto:ekrem@klinovax.com')
    for (const href of ['/hakkimizda', '/kvkk', '/privacy', '/cerez-politikasi', '/data-retention', '/terms']) {
      expect(html).toContain(`href="${href}"`)
    }
  })

  it('EN: İngilizce etiketler ve /en bağlantıları', () => {
    const html = renderToStaticMarkup(<SiteFooter locale="en" />)
    expect(html).toContain(`Founded: ${BRAND.legal.foundedYear}`)
    expect(html).toContain('href="/en#about"')
    expect(html).not.toContain('Kuruluş')
  })

  it('görünen metinde kimlik/vergi numarası gibi uzun rakam dizisi yok', () => {
    expect(visibleText(renderToStaticMarkup(<SiteFooter />))).not.toMatch(/\d{10,}/)
  })
})

describe('SiteHeader', () => {
  it('Demo CTA, giriş bağlantısı, atlama bağlantısı ve JS\'siz mobil menü', () => {
    const html = renderToStaticMarkup(<SiteHeader />)
    expect(html).toContain('href="/demo"')
    expect(html).toContain('Demo Talep Edin')
    expect(html).toContain('href="/auth/login"')
    expect(html).toContain('href="#icerik"')
    expect(html).toMatch(/<details[^>]*class="s-menu"/)
  })
})

describe('ana sayfa metinleri: iddia politikası', () => {
  const text = JSON.stringify(HOME_TR)

  it('yasaklı iddialar ve em-dash yok', () => {
    for (const banned of [
      /KVKK uyumlu/i,
      /değiştirilemez/i,
      /Türkiye'de (tutulur|saklanır)|veriler(iniz)? Türkiye/i,
      /\bSSO\b/,
      /\bSMG\b/,
      /akreditasyon/i,
      /\bJCI\b|\bISO ?\d|SOC ?2/,
      /—/,
    ]) {
      expect(text).not.toMatch(banned)
    }
  })

  it('uydurma istatistik yok (yüzde ve büyük sayılar)', () => {
    expect(text).not.toMatch(/%\s?\d|\d+\s?%/)
    expect(text).not.toMatch(/\d{2,}[.,]?\d*\+/)
  })
})
