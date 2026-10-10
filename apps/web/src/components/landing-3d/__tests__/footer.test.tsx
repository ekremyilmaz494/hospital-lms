import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer } from '../footer';
import { BRAND } from '@/lib/brand';

describe('landing Footer — işletme künyesi', () => {
  it('TR: işletme adı, kuruluş yılı, şehir ve kurumsal e-posta görünür', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(BRAND.legal.businessName);
    expect(html).toContain(`Kuruluş: ${BRAND.legal.foundedYear}`);
    expect(html).toContain('Konya, Türkiye');
    expect(html).toContain('mailto:ekrem@klinovax.com');
    expect(html).toContain('href="/hakkimizda"');
  });

  it('EN: İngilizce etiketler ve /en bağlantıları', () => {
    const html = renderToStaticMarkup(<Footer locale="en" />);
    expect(html).toContain(`Founded: ${BRAND.legal.foundedYear}`);
    expect(html).toContain('href="/en#about"');
    expect(html).not.toContain('Kuruluş');
  });

  it('kişisel kimlik/vergi numarası gibi uzun rakam dizisi içermez', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/\d{10,}/);
  });
});
