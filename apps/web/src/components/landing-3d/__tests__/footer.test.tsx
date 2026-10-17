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

  it('TR: ürün linkleri (demo, SSS, iletişim) ve ayrı yasal nav', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain('href="/demo"');
    expect(html).toContain('href="/#sss"');
    expect(html).toContain('href="/guvenlik"');
    expect(html).toContain('href="/iletisim"');
    expect(html).not.toContain('href="/contact"');
    for (const href of ['/privacy', '/kvkk', '/cerez-politikasi', '/data-retention', '/terms']) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('Çerez Politikası');
    expect(html).toContain('Veri Saklama');
    // İki ayrı nav, ikisi de etiketli
    expect(html).toContain('aria-label="Alt bilgi bağlantıları"');
    expect(html).toContain('aria-label="Yasal bağlantılar"');
    expect(html.match(/<nav /g)).toHaveLength(2);
  });

  it('EN: KVKK ve Çerez linkleri hrefLang="tr" ile, nav etiketleri İngilizce', () => {
    const html = renderToStaticMarkup(<Footer locale="en" />);
    expect(html).toMatch(/<a[^>]*href="\/kvkk"[^>]*hrefLang="tr"|<a[^>]*hrefLang="tr"[^>]*href="\/kvkk"/);
    expect(html).toMatch(
      /<a[^>]*href="\/cerez-politikasi"[^>]*hrefLang="tr"|<a[^>]*hrefLang="tr"[^>]*href="\/cerez-politikasi"/,
    );
    // Türkçe sayfalara giden TÜM yasal linkler dil notu taşır (liste kendi içinde tutarlı)
    for (const href of ['/privacy', '/terms']) {
      expect(html).toMatch(
        new RegExp(`<a[^>]*href="${href}"[^>]*hrefLang="tr"|<a[^>]*hrefLang="tr"[^>]*href="${href}"`),
      );
    }
    expect(html).toContain('Privacy (Turkish)');
    expect(html).toContain('Terms (Turkish)');
    expect(html).toContain('aria-label="Footer links"');
    expect(html).toContain('aria-label="Legal"');
    // EN'de mağaza rozetlerinin erişilebilir adı İngilizce
    expect(html).toContain('Download the');
    expect(html).not.toContain('uygulamasını');
  });

  it('görünen metinde kimlik/vergi numarası gibi uzun rakam dizisi yok', () => {
    // Yalnız görünen metin — mağaza linklerindeki uygulama ID'leri (href) kapsam dışı.
    const text = renderToStaticMarkup(<Footer />).replace(/<[^>]+>/g, ' ');
    expect(text).not.toMatch(/\d{10,}/);
  });
});
