import { describe, it, expect } from 'vitest';
import {
  BUDGETS,
  DIFFERENTIATORS,
  FEATURE_GROUPS,
  HERO,
  MAIN_SECTION_IDS,
  MODULES,
  SECTIONS,
  SECTION_IDS,
  STATS,
} from '../content';

/**
 * 3D koruması: telefonun scroll timeline'ı `<main>` içindeki 6 bölümün her birinin
 * ~100vh olduğunu varsayar. Metin uzarsa bölüm 100vh'yi aşar ve telefon pozu kayar.
 * Bu bütçeler bilerek SERT tutulur — artırmadan önce 1280x800'de ölçün.
 */

/** İçerik yenilemesi öncesi başlık satır uzunlukları (aşılamaz). */
const LEGACY_HEADLINE_MAX: Record<string, number[]> = {
  hero: ['Eğitimi yükleyin,'.length, 'gerisi otomatik.'.length],
  egitim: ['Eğitimi siz tasarlayın,'.length, 'sistem yürütsün.'.length],
  kanit: ['Denetime'.length, 'her an hazır.'.length],
  olcek: ['Mesai kaybı'.length, 'olmadan eğitin.'.length],
  erisim: ['Her yerden,'.length, 'her cihazdan.'.length],
  guven: ['Sahada'.length, 'kullanılıyor.'.length],
};

const MAIN_KEYS = ['egitim', 'kanit', 'olcek', 'erisim', 'guven'] as const;

describe('<main> metin bütçeleri (3D koruması)', () => {
  it('hero lead bütçeyi aşmaz', () => {
    expect(HERO.lead.length).toBeLessThanOrEqual(BUDGETS.heroLead);
  });

  it('egitim ve kanit lead <= 250', () => {
    expect(SECTIONS.egitim.lead.length).toBeLessThanOrEqual(250);
    expect(SECTIONS.kanit.lead.length).toBeLessThanOrEqual(250);
  });

  it('olcek lead <= 400, erisim lead <= 250, guven lead <= 300', () => {
    expect(SECTIONS.olcek.lead.length).toBeLessThanOrEqual(400);
    expect(SECTIONS.erisim.lead.length).toBeLessThanOrEqual(250);
    expect(SECTIONS.guven.lead.length).toBeLessThanOrEqual(300);
  });

  it('egitim ve kanit bölümlerinde TAM 4 modül vardır', () => {
    expect(MODULES.egitim).toHaveLength(4);
    expect(MODULES.kanit).toHaveLength(4);
  });

  it('egitim ve kanit modül açıklaması <= 48', () => {
    for (const m of [...MODULES.egitim, ...MODULES.kanit]) {
      expect(m.desc.length, `${m.title}: ${m.desc}`).toBeLessThanOrEqual(48);
    }
  });

  it('diğer bölümlerde modül açıklaması <= 70', () => {
    for (const m of [...MODULES.olcek, ...MODULES.erisim]) {
      expect(m.desc.length, `${m.title}: ${m.desc}`).toBeLessThanOrEqual(70);
    }
  });

  it('tüm modül başlıkları <= 20 karakter', () => {
    for (const m of Object.values(MODULES).flat()) {
      expect(m.title.length, m.title).toBeLessThanOrEqual(20);
    }
  });

  it('farklılaştırıcı açıklamaları <= 80', () => {
    for (const d of DIFFERENTIATORS.items) {
      expect(d.desc.length, d.desc).toBeLessThanOrEqual(80);
    }
  });

  it('istatistik etiketleri <= 18 ve yalnızca 3 doğrulanabilir değer', () => {
    expect(STATS).toHaveLength(3);
    for (const s of STATS) expect(s.label.length, s.label).toBeLessThanOrEqual(18);
    expect(STATS.map((s) => `${s.value}${s.unit ?? ''} ${s.label}`)).toEqual([
      '7 RAPOR TÜRÜ',
      '256 bit DOSYA ŞİFRELEME',
      '3 PLATFORM',
    ]);
  });

  it('başlık satırları mevcut satır uzunluklarını aşmaz', () => {
    const lines: Record<string, readonly string[]> = {
      hero: HERO.headline,
      egitim: SECTIONS.egitim.headline,
      kanit: SECTIONS.kanit.headline,
      olcek: SECTIONS.olcek.headline,
      erisim: SECTIONS.erisim.headline,
      guven: SECTIONS.guven.headline,
    };
    for (const [key, max] of Object.entries(LEGACY_HEADLINE_MAX)) {
      expect(lines[key], key).toHaveLength(max.length);
      lines[key].forEach((line, i) => {
        expect(line.length, `${key}[${i}]: ${line}`).toBeLessThanOrEqual(max[i]);
      });
    }
  });

  it('<main> bölüm id\'leri değişmez ve ilk 6 sırada kalır', () => {
    expect(MAIN_SECTION_IDS).toEqual(['hero', 'egitim', 'kanit', 'olcek', 'erisim', 'guven']);
    expect(SECTION_IDS.slice(0, 6)).toEqual(MAIN_SECTION_IDS);
  });

  it('showcase sonrası bant id\'leri tanımlı', () => {
    expect(SECTION_IDS.slice(6)).toEqual([
      'platform',
      'nasil-calisir',
      'ozellikler',
      'sss',
    ]);
  });

  it('ana bölümlerin hepsi tanımlı ve sınır sabitleri tutarlı', () => {
    for (const k of MAIN_KEYS) expect(SECTIONS[k].lead.length).toBeGreaterThan(0);
    expect(BUDGETS.denseModuleCount).toBe(4);
  });
});

describe('bant içerik bütçeleri (showcase sonrası)', () => {
  it('özellik grupları 4 adet ve modül açıklamaları <= 70', () => {
    expect(FEATURE_GROUPS.groups).toHaveLength(4);
    for (const g of FEATURE_GROUPS.groups) {
      for (const m of g.modules) {
        expect(m.title.length, m.title).toBeLessThanOrEqual(24);
        expect(m.desc.length, `${m.title}: ${m.desc}`).toBeLessThanOrEqual(70);
      }
    }
  });
});
