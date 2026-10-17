import { describe, it, expect } from 'vitest';
import { config } from '@/proxy';

// Next matcher kaynağı `/(...)` biçiminde bir regex; tam eşleşme olarak test ediyoruz.
const matcher = new RegExp(`^${config.matcher[0]}$`);
const runsProxy = (path: string) => matcher.test(path);

describe('proxy matcher', () => {
  it.each([
    '/',
    '/admin/dashboard',
    '/hakkimizda',
    '/opengraph-image',
    '/auth/login',
    '/monitoringx',
  ])('%s proxy\'den geçer', (path) => {
    expect(runsProxy(path)).toBe(true);
  });

  it.each([
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap/0.xml',
    '/0f3a9c1b2d.txt',
    '/_vercel/insights/script.js',
    '/monitoring',
    '/monitoring/envelope',
    '/_next/static/chunk.js',
    '/sw.js',
    '/logos/devakent.png',
  ])('%s proxy\'den geçmez (statik / tünel)', (path) => {
    expect(runsProxy(path)).toBe(false);
  });
});
