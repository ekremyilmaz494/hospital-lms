import { describe, it, expect } from 'vitest';
import { organizationJsonLd, FOUNDING_DATE } from '../organization-jsonld';

describe('organizationJsonLd', () => {
  it('kurumsal künyeyi geçerli JSON olarak üretir', () => {
    const data = JSON.parse(organizationJsonLd('en'));
    expect(data['@type']).toBe('Organization');
    expect(data.url).toBe('https://klinovax.com');
    expect(data.foundingDate).toBe(FOUNDING_DATE);
    expect(data.founder.name).toBe('Ekrem Yılmaz');
    expect(data.email).toMatch(/@klinovax\.com$/);
  });

  it('her iki dilde açıklamada eczane/pharmacy geçmez', () => {
    for (const locale of ['tr', 'en'] as const) {
      const data = JSON.parse(organizationJsonLd(locale));
      expect(data.description).not.toMatch(/eczane|pharmac/i);
      expect(data.description.length).toBeGreaterThan(20);
    }
  });

  it('script kırılmasına karşı < karakterini kaçışlar', () => {
    expect(organizationJsonLd()).not.toContain('<');
  });
});
