import { describe, it, expect } from 'vitest';
import { isPublicRoute } from '../middleware';

describe('isPublicRoute — pazarlama sayfaları', () => {
  it.each([
    '/',
    '/en',
    '/hakkimizda',
    '/contact',
    '/iletisim',
    '/sss',
    '/guvenlik',
    '/kvkk',
    '/cerez-politikasi',
    '/data-retention',
    '/opengraph-image',
  ])('%s public', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each(['/enrollments', '/english', '/admin', '/staff/dashboard', '/demox'])(
    '%s public DEĞİL (prefix sızıntısı yok)',
    (path) => {
      expect(isPublicRoute(path)).toBe(false);
    },
  );
});
