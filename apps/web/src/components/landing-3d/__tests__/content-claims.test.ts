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
  SECURITY,
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
    SECURITY,
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
    const kurumsal = SECURITY.rows.find((r) => r.label === 'KURUMSAL');
    expect(kurumsal).toBeDefined();
    for (const item of kurumsal!.items) expect(item.note).toBe('Talep üzerine');
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

  it('kapanış CTA: 30 gün ücretsiz deneme + /demo ve /contact', () => {
    expect(FINAL_CTA.title).toMatch(/30 gün/);
    expect(FINAL_CTA.primary.href).toBe('/demo');
    expect(FINAL_CTA.secondary.href).toBe('/contact');
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

describe('demo sayfası', () => {
  it('demo-client içinde "14 gün" deneme ifadesi yok', () => {
    const file = join(process.cwd(), 'src/app/(marketing)/demo/demo-client.tsx');
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/14 g[uü]n/i);
  });
});

/** Ana sayfa dışındaki yüzeylerde (EN sayfası, hakkımızda, sektör, kayıt) da aynı iddia disiplini. */
describe('diğer yüzeylerde doğrulanamayan iddialar', () => {
  const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');

  const SURFACES: { file: string; forbidden: { label: string; pattern: RegExp }[] }[] = [
    {
      file: 'src/app/en/page.tsx',
      forbidden: [
        { label: 'not reassigned automatically', pattern: /not reassigned automatically/i },
        { label: 'tamper-resistant', pattern: /tamper-resistant/i },
        { label: 'protected against tampering', pattern: /protected against tampering/i },
        { label: 'never exceed real elapsed time', pattern: /(?:never|cannot) exceed real elapsed time/i },
        { label: 'measured on the server', pattern: /measured on the server/i },
        { label: 'çıplak KVKK etiketi (açılımsız)', pattern: /label: 'KVKK',/ },
      ],
    },
    {
      file: 'src/app/hakkimizda/page.tsx',
      forbidden: [{ label: 'sunucuda ölçülür', pattern: /sunucuda ölçülür/ }],
    },
    {
      file: 'src/app/(marketing)/sectors/[sector]/page.tsx',
      forbidden: [
        { label: 'unvan bazında', pattern: /unvan/i },
        { label: 'Bakanlık', pattern: /Bakanlık/i },
        { label: 'SMG', pattern: /\bSMG\b/ },
      ],
    },
    {
      file: 'src/app/(marketing)/register/page.tsx',
      forbidden: [{ label: '256-bit SSL rozeti', pattern: /256-bit SSL/ }],
    },
    {
      file: 'src/app/(marketing)/privacy/page.tsx',
      forbidden: [{ label: 'meta description: KVKK uyumlu', pattern: /KVKK uyumlu/i }],
    },
  ];

  for (const { file, forbidden } of SURFACES) {
    for (const { label, pattern } of forbidden) {
      it(`${file}: geçmemeli: ${label}`, () => {
        expect(read(file)).not.toMatch(pattern);
      });
    }
  }

  it('EN SSS: otomatik yeniden açılma sertifika yenilemesi için belirtilir', () => {
    expect(read('src/app/en/page.tsx')).toMatch(/reopens automatically when the certificate expires/);
  });

  it('saklama politikası: denetim kaydı süresi kuruma özel, sabit "3 yıl" yok', () => {
    const src = read('src/app/(marketing)/data-retention/page.tsx');
    expect(src).toMatch(/category: 'Denetim Kayıtları'[^}]*Kuruma özel/);
    expect(src).not.toMatch(/category: 'Denetim Kayıtları'[^}]*3 yıl/);
    expect(src).not.toMatch(/tam izlenebilirlik/);
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
