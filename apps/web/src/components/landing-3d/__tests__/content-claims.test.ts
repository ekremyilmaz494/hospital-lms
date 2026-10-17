import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  DIFFERENTIATORS,
  FAQ,
  FEATURE_GROUPS,
  FINAL_CTA,
  FLOW,
  HERO,
  MODULES,
  SECTIONS,
  SHOWCASE,
  STATS,
  faqJsonLd,
} from '../content';

/** İçerikteki TÜM görünür metni tek bir dizeye indirger. */
function allCopy(): string {
  return JSON.stringify({
    HERO,
    SECTIONS,
    MODULES,
    STATS,
    DIFFERENTIATORS,
    SHOWCASE,
    FLOW,
    FEATURE_GROUPS,
    FAQ,
    FINAL_CTA,
  });
}

/** Doğrulanamayan / yanlış iddialar — içerikte geçmemeli. */
const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'sahte istatistik 12.480', pattern: /12\.480/ },
  { label: 'sahte istatistik %94', pattern: /%\s?94/ },
  { label: 'sahte istatistik 40+', pattern: /40\s?\+/ },
  { label: 'eczane', pattern: /eczane/i },
  { label: 'role göre atama', pattern: /role göre/i },
  { label: 'LMS jargonu', pattern: /LMS/ },
  { label: 'Audit jargonu', pattern: /audit/i },
  { label: 'değiştirilemez', pattern: /değiştirilemez/i },
  { label: 'KVKK Uyum Raporu', pattern: /KVKK Uyum Raporu/i },
  { label: 'KVKK uyumlu kılar', pattern: /uyumlu kıl/i },
  { label: 'sınavını olur', pattern: /sınavını olur/i },
  { label: "Türkiye'de", pattern: /Türkiye['’]de/i },
  { label: 'veriler Türkiye', pattern: /Türkiye(?:'|’)?\s*(?:sınırları|içinde)/i },
  { label: 'SLA vaadi', pattern: /\bSLA\b/ },
  { label: '14 günlük deneme', pattern: /14\s*g[uü]n/i },
  { label: 'müşteri sayısı iddiası', pattern: /\d+\s*\+?\s*(?:kurum|hastane|müşteri)\b/i },
  // Kodla doğrulanamayan / yanlış çıkan iddialar (bağımsız inceleme sonrası)
  { label: 'otomatik yeniden atama yok (yanlış: sertifika yenilemesi yeniden açar)', pattern: /Otomatik yeniden atama yoktur/i },
  { label: 'unvan bazında uyum raporu (rapor yalnız departman/eğitim)', pattern: /unvan/i },
  { label: 'Bakanlık dışa aktarımı (arayüzde yok)', pattern: /Bakanlık/i },
  { label: 'SMG (menüden erişilemiyor)', pattern: /\bSMG\b/ },
  { label: 'kurcalamaya karşı korumalı (yalnız tamper-evident)', pattern: /kurcalamaya karş/i },
  { label: 'sunucu izleme süresini ölçer (istemci raporlar, sunucu doğrular)', pattern: /sunucu(?:da|nun)?\s+(?:gerçek\s+)?(?:izleme\s+süresini\s+)?ölç/i },
];

describe('ana sayfa içerik iddiaları', () => {
  const copy = allCopy();

  for (const { label, pattern } of FORBIDDEN) {
    it(`geçmemeli: ${label}`, () => {
      expect(copy).not.toMatch(pattern);
    });
  }

  it('"Kanıt" eyebrow tutarsızlığı yok: bölüm eyebrow\'u UYUM & RAPORLAMA', () => {
    expect(SECTIONS.kanit.eyebrow).toBe('UYUM & RAPORLAMA');
  });

  it('barındırma Frankfurt (AB) olarak belirtilir', () => {
    expect(copy).toMatch(/Frankfurt/);
  });

  it('SSO ve kurum içi kurulum "talep üzerine" olarak işaretli', () => {
    const item = FAQ.items.find((f) => /SSO/.test(f.a));
    expect(item).toBeDefined();
    expect(item!.a).toMatch(/talep üzerine/i);
  });

  it('referans müşteri yalnızca Özel Devakent Hastanesi', () => {
    expect(SECTIONS.guven.trust.name).toBe('Özel Devakent Hastanesi');
  });

  it('SSS: otomatik yeniden atama yalnızca yenileme süreli eğitimlerde, doğru tarif edilir', () => {
    const item = FAQ.items.find((f) => f.q.includes('Sınavı geçemeyen'));
    expect(item).toBeDefined();
    expect(item!.a).toMatch(/Yenileme süresi tanımlı eğitimlerde/);
    expect(item!.a).toMatch(/kendiliğinden yeniden açılır/);
    expect(item!.a).toMatch(/aktif eğitim dönemi/);
  });

  it('yönetici koltuğu sayısı sabit ürün sınırı gibi sunulmaz', () => {
    expect(copy).not.toMatch(/5 yönetici/);
  });

  it('kapanış CTA: 30 gün ücretsiz deneme + /demo ve /iletisim', () => {
    expect(FINAL_CTA.title).toMatch(/30 gün/);
    expect(FINAL_CTA.primary.href).toBe('/demo');
    expect(FINAL_CTA.secondary.href).toBe('/iletisim');
  });
});

describe('SSS', () => {
  it('10-14 soru içerir', () => {
    expect(FAQ.items.length).toBeGreaterThanOrEqual(10);
    expect(FAQ.items.length).toBeLessThanOrEqual(14);
  });

  it('en az bir cevapta "30 gün" geçer', () => {
    expect(FAQ.items.some((f) => f.a.includes('30 gün'))).toBe(true);
  });

  it('sorular benzersiz', () => {
    expect(new Set(FAQ.items.map((f) => f.q)).size).toBe(FAQ.items.length);
  });

  it('FAQPage JSON-LD: tüm sorular var ve "<" kaçışlı', () => {
    const json = faqJsonLd();
    expect(json).not.toContain('<');
    const parsed = JSON.parse(json) as {
      '@type': string;
      mainEntity: { name: string }[];
    };
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity).toHaveLength(FAQ.items.length);
  });
});

describe('telefon ekranı canvas metinleri', () => {
  const screens = readFileSync(
    join(process.cwd(), 'src/components/landing-3d/phone-screens.ts'),
    'utf8',
  );

  it('uydurma istatistik ve çoğul müşteri iddiası içermez', () => {
    expect(screens).not.toMatch(/%\s?94/);
    expect(screens).not.toMatch(/ortalama başarı oranı/i);
    expect(screens).not.toMatch(/Sağlık kurumlarının/i);
    expect(screens).not.toMatch(/Sahada kanıtlı/i);
  });
});
