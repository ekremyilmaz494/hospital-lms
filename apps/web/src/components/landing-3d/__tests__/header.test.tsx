import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../header';
import { LANDING_NAV } from '../locale';

/** class'ı `cls` içeren <a> etiketlerinin tamamı. */
function anchorsWithClass(html: string, cls: string): string[] {
  return (html.match(/<a\b[^>]*>/g) ?? []).filter((a) => new RegExp(`class="[^"]*${cls}`).test(a));
}

describe('landing Header', () => {
  it('TR: nav etiketli, yalnız both öğeleri; Nasıl Çalışır header\'da yok', () => {
    const html = renderToStaticMarkup(<Header />);
    expect(html).toMatch(/<nav[^>]*class="l3d-nav"[^>]*aria-label="Ana menü"/);
    for (const href of ['/#egitim', '/#kanit', '/guvenlik', '/#sss', '/hakkimizda', '/iletisim']) {
      expect(html).toContain(`href="${href}"`);
    }
    // drawer'a özel öğe: drawer kapalıyken hiçbir yerde yok
    expect(html).not.toContain('/#nasil-calisir');
  });

  it('TR: SSS ikincil öncelik işaretli, diğerleri işaretsiz', () => {
    const html = renderToStaticMarkup(<Header />);
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav.match(/data-priority="secondary"/g)).toHaveLength(1);
    expect(nav).toMatch(/href="\/#sss"[^>]*data-priority="secondary"|data-priority="secondary"[^>]*href="\/#sss"/);
  });

  it('TR: header CTA /demo adresine gider', () => {
    const html = renderToStaticMarkup(<Header />);
    const [cta, ...rest] = anchorsWithClass(html, 'l3d-header-cta');
    expect(rest).toHaveLength(0);
    expect(cta).toContain('href="/demo"');
    expect(html).toContain('Demo Talep Edin');
  });

  it('EN: header CTA /en#contact adresine gider, nav hedefleri /en altında', () => {
    const html = renderToStaticMarkup(<Header locale="en" />);
    const [cta] = anchorsWithClass(html, 'l3d-header-cta');
    expect(cta).toContain('href="/en#contact"');
    expect(html).not.toContain('href="/demo"');
    expect(html).toMatch(/<nav[^>]*aria-label="Main menu"/);
    expect(html).toContain('href="/en#product"');
  });

  it('hamburger aria-controls taşır ve başlangıçta kapalıdır', () => {
    const html = renderToStaticMarkup(<Header />);
    const btn = html.match(/<button\b[^>]*class="l3d-menu-btn"[^>]*>/)?.[0] ?? '';
    expect(btn).toMatch(/aria-controls="[^"]+"/);
    expect(btn).toContain('aria-expanded="false"');
  });

  it('aktif dil span\'inde aria-current yok; ekran okuyucu metni var', () => {
    const html = renderToStaticMarkup(<Header />);
    expect(html).not.toMatch(/<span[^>]*aria-current/);
    expect(html).toContain('(geçerli dil)');
    const en = renderToStaticMarkup(<Header locale="en" />);
    expect(en).toContain('(current language)');
  });

  it('menü verisi: TR\'de SSS ikincil, yalnız "Nasıl Çalışır" drawer\'a özel; EN\'de ayrım yok', () => {
    const tr = LANDING_NAV.tr;
    expect(tr.filter((i) => i.priority === 'secondary').map((i) => i.icon)).toEqual(['faq']);
    expect(tr.filter((i) => i.placement === 'drawer').map((i) => i.icon)).toEqual(['flow']);
    const en = LANDING_NAV.en;
    expect(en.filter((i) => i.priority === 'secondary')).toEqual([]);
    expect(en.filter((i) => i.placement === 'drawer')).toEqual([]);
  });
});
