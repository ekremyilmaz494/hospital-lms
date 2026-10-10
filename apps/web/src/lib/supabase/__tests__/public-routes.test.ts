import { describe, it, expect } from 'vitest';
import { isPublicRoute } from '../middleware';

describe('isPublicRoute — pazarlama sayfaları', () => {
  it.each(['/', '/en', '/hakkimizda', '/contact', '/kvkk'])('%s public', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each(['/enrollments', '/english', '/admin', '/staff/dashboard'])(
    '%s public DEĞİL (prefix sızıntısı yok)',
    (path) => {
      expect(isPublicRoute(path)).toBe(false);
    },
  );
});
