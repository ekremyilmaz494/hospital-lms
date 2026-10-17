import { describe, it, expect } from 'vitest';
import sitemap from '../sitemap';
import robots from '../robots';
import { isPublicRoute } from '@/lib/supabase/middleware';

/** Sitemap girdisinin yol kısmı (kök için '/'). */
function pathOf(url: string): string {
  return new URL(url).pathname || '/';
}

describe('sitemap — public route tutarlılığı', () => {
  const entries = sitemap();

  it('sitemap boş değil', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((e) => pathOf(e.url)))(
    '%s middleware tarafından public sayılıyor (login yönlendirmesi yok)',
    (path) => {
      expect(isPublicRoute(path)).toBe(true);
    },
  );

  it('yasal sayfalar, kayıt ve sağlık sektörü sayfası sitemap içinde', () => {
    const paths = entries.map((e) => pathOf(e.url));
    for (const expected of [
      '/privacy',
      '/terms',
      '/cerez-politikasi',
      '/data-retention',
      '/register',
      '/sectors/healthcare',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('yol tekrarı yok', () => {
    const paths = entries.map((e) => pathOf(e.url));
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('robots — allow listesi sitemap ile uyumlu', () => {
  it('sitemap içindeki her yol allow listesinde', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = ([] as string[]).concat(rule.allow ?? []);
    for (const entry of sitemap()) {
      expect(allow).toContain(pathOf(entry.url));
    }
  });
});
