import { describe, it, expect } from 'vitest';
import { SITE_ROUTES, getIndexablePaths, isPublicRoute } from '../site-routes';

describe('isPublicRoute — segment sınırında eşleşme', () => {
  it.each([
    '/',
    '/en',
    '/en/hakkimizda',
    '/hakkimizda',
    '/demo',
    '/contact',
    '/iletisim',
    '/sss',
    '/guvenlik',
    '/kvkk',
    '/privacy',
    '/terms',
    '/cerez-politikasi',
    '/data-retention',
    '/sectors/healthcare',
    '/certificates/verify/CERT-ABC123',
    '/davet/token-123',
    '/auth/login',
    '/auth/callback',
    '/login',
    '/offline',
    '/opengraph-image',
    '/twitter-image',
    '/icon',
    '/apple-icon',
  ])('%s public', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each([
    '/demox',
    '/demo-x',
    '/helpers',
    '/licenses',
    '/kvkk-raporu',
    '/registered',
    '/termsx',
    '/auth/login-bypass',
    '/auth/change-password',
    '/auth/sms-verify',
    '/sectorsx',
    '/davetiye',
    '/offline/x',
    '/login/x',
  ])('%s public DEĞİL (prefix sızıntısı yok)', (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });

  it('kök yol alt ağacı açmaz', () => {
    expect(isPublicRoute('/admin')).toBe(false);
    expect(isPublicRoute('/anything')).toBe(false);
  });
});

describe('SITE_ROUTES bütünlüğü', () => {
  it('her yol / ile başlar ve sonda / içermez (kök hariç)', () => {
    for (const route of SITE_ROUTES) {
      expect(route.path.startsWith('/')).toBe(true);
      if (route.path !== '/') expect(route.path.endsWith('/')).toBe(false);
    }
  });

  it('yinelenen yol yok', () => {
    const paths = SITE_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('korumalı panel yolları asla listede değil', () => {
    for (const panel of ['/admin', '/staff', '/super-admin', '/group', '/exam']) {
      expect(isPublicRoute(panel)).toBe(false);
      expect(isPublicRoute(`${panel}/dashboard`)).toBe(false);
    }
  });
});

describe('getIndexablePaths', () => {
  it('pazarlama + hukuki sayfaları içerir', () => {
    const paths = getIndexablePaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/en',
        '/hakkimizda',
        '/demo',
        '/iletisim',
        '/sss',
        '/guvenlik',
        '/kvkk',
        '/privacy',
        '/terms',
        '/cerez-politikasi',
        '/data-retention',
      ]),
    );
  });

  it('auth, API ve yardımcı rotaları içermez', () => {
    const paths = getIndexablePaths();
    for (const path of paths) {
      expect(path.startsWith('/api')).toBe(false);
      expect(path.startsWith('/auth')).toBe(false);
    }
    expect(paths).not.toContain('/register');
    expect(paths).not.toContain('/dev-reset');
    expect(paths).not.toContain('/opengraph-image');
  });

  it('indekslenebilir her yol public', () => {
    for (const path of getIndexablePaths()) {
      expect(isPublicRoute(path)).toBe(true);
    }
  });
});
