import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollSections } from '../scroll-sections';
import { LANDING_COPY, LANDING_NAV } from '../locale';

const EN_PAGE_SOURCE = readFileSync(resolve(__dirname, '../../../app/en/page.tsx'), 'utf8');

/** Çıktıdaki tüm id="..." değerleri. */
function collectIds(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
}

describe('landing nav hedefleri (çapraz doğrulama)', () => {
  const html = renderToStaticMarkup(<ScrollSections />);

  it('TR: her "/#x" nav href\'i ScrollSections çıktısında id="x" olarak bulunur', () => {
    const anchors = LANDING_NAV.tr.filter((i) => i.href.startsWith('/#'));
    expect(anchors.length).toBeGreaterThan(0);
    for (const { href } of anchors) {
      const id = href.slice(2);
      expect(html, `id="${id}" yok`).toContain(`id="${id}"`);
    }
  });

  it('EN: her "/en#x" nav href\'i en/page.tsx kaynağında id olarak bulunur', () => {
    const anchors = LANDING_NAV.en.filter((i) => i.href.startsWith('/en#'));
    expect(anchors.length).toBeGreaterThan(0);
    for (const { href } of anchors) {
      const id = href.slice(4);
      const found = EN_PAGE_SOURCE.includes(`id="${id}"`) || EN_PAGE_SOURCE.includes(`id='${id}'`);
      expect(found, `en/page.tsx içinde id="${id}" yok`).toBe(true);
    }
  });

  it('EN demo CTA hedefi /demo değildir ve /en altındadır', () => {
    expect(LANDING_COPY.en.demoHref).not.toBe('/demo');
    expect(LANDING_COPY.en.demoHref.startsWith('/en')).toBe(true);
    expect(LANDING_COPY.tr.demoHref).toBe('/demo');
  });

  it('ScrollSections çıktısında tekrar eden id yok', () => {
    const ids = collectIds(html);
    expect(ids.length).toBeGreaterThan(0);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('en/page.tsx kaynağındaki statik id\'ler tekrar etmez', () => {
    const ids = [...EN_PAGE_SOURCE.matchAll(/\bid="([^"{}]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
