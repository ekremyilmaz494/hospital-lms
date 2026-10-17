import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * (marketing) altındaki sayfa/istemci kaynaklarında ASCII'ye indirgenmiş Türkçe görünen
 * metin kalmadığını doğrular (ör. "Iletisim", "Giris Yap", "Ucretsiz").
 * Yalnızca TAM KELİME eşleşir; büyük/küçük harf duyarlıdır — örn. API sözleşmesindeki
 * "[ILETISIM FORMU]" öneki (büyük harf, sunucu parse eder) yanlış pozitif üretmez.
 */
const MARKETING_DIR = join(__dirname, '..');

const ASCII_TURKISH_TOKENS = [
  'Iletisim',
  'Giris Yap',
  'Ucretsiz',
  'Kisisel',
  'Egitim',
  'Sinav',
  'Sartlari',
  'Gonder',
  'Gonderiliyor',
  'olustu',
  'Lutfen',
  'gunluk',
  'Tum haklari',
  'Saklama Politikasi',
  'Gizlilik Politikasi',
  'Cerez Politikasi',
  'Kullanim Sartlari',
  'basariyla',
  'Basarili',
  'Baglanti',
  'Seciniz',
  'Soyadiniz',
  'Adiniz',
  'Sifre',
];
const TOKEN_REGEX = new RegExp(`\\b(${ASCII_TURKISH_TOKENS.join('|')})\\b`);

/** İstemci/sayfa kaynakları: page.tsx ve *-client.tsx (test klasörleri hariç). */
function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;
      out.push(...collectSources(full));
    } else if (name === 'page.tsx' || name.endsWith('-client.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Yorum satırlarını at (ASCII yorumlar kullanıcıya görünmez). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('(marketing) — Türkçe karakter bütünlüğü', () => {
  const sources = collectSources(MARKETING_DIR);

  it('kaynak dosyalar bulundu', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(sources.map((f) => [relative(MARKETING_DIR, f), f]))(
    '%s ASCII-Türkçe belirteç içermiyor',
    (_rel, file) => {
      const text = stripComments(readFileSync(file, 'utf-8'));
      const hit = text.match(TOKEN_REGEX);
      expect(hit?.[0] ?? null).toBeNull();
    },
  );

  it('demo istemcisinde eski 14 günlük deneme ifadesi yok', () => {
    const demo = readFileSync(join(MARKETING_DIR, 'demo', 'demo-client.tsx'), 'utf-8');
    expect(demo).not.toMatch(/14\s*g[uü]nl[uü]k/i);
    expect(demo).toContain('30');
  });
});
