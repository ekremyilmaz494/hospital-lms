import { describe, it, expect } from 'vitest';
import { durationChartHeight } from '../duration-chart';

/**
 * Regresyon kilidi: Süre Analizi grafiği SABİT yükseklikte çizilirse (eski `h-80` = 320px)
 * eğitim sayısı arttıkça eksen etiketleri üst üste biner. Y ekseninde `interval={0}` verildiği
 * için recharts'ın "çakışan etiketi atla" güvenlik ağı da yok — okunabilirlik tamamen bu
 * yükseklik hesabına bağlı. Bu testler o sözleşmeyi kilitler.
 */
describe('durationChartHeight', () => {
  const ROW_HEIGHT = 52; // kategori başına 2 çubuk (2 × 18 = 36px) + nefes payı
  const MIN_HEIGHT = 320;

  it('kategori sayısıyla doğrusal büyür — sabit yükseklik bug idi', () => {
    expect(durationChartHeight(10)).toBe(10 * ROW_HEIGHT);
    expect(durationChartHeight(15)).toBe(15 * ROW_HEIGHT); // Devakent prod: 15 eğitim
    expect(durationChartHeight(40)).toBe(40 * ROW_HEIGHT);
  });

  it('az kategoride taban yüksekliğin altına inmez', () => {
    expect(durationChartHeight(0)).toBe(MIN_HEIGHT);
    expect(durationChartHeight(1)).toBe(MIN_HEIGHT);
    expect(durationChartHeight(6)).toBe(MIN_HEIGHT); // 6 × 52 = 312 < 320
  });

  it('taban yükseklik ile doğrusal büyüme arasındaki eşikte tutarlı', () => {
    // 320 / 52 ≈ 6.15 → 7. kategoriden itibaren büyüme devralır
    expect(durationChartHeight(7)).toBe(7 * ROW_HEIGHT);
    expect(durationChartHeight(7)).toBeGreaterThan(MIN_HEIGHT);
  });

  it('her kategoriye çubukların sığacağı kadar dikey alan bırakır', () => {
    // Asıl sözleşme: satır başına düşen alan, iki çubuğun kapladığı 36px'in altına İNMEMELİ.
    // Bu ihlal edilirse etiketler çakışır — bug'ın kendisi buydu.
    const BARS_PER_ROW_PX = 2 * 18;
    for (const count of [7, 15, 40, 100, 500]) {
      expect(durationChartHeight(count) / count).toBeGreaterThan(BARS_PER_ROW_PX);
    }
  });

  it('API üst sınırında (500 eğitim) bile hesap taşmaz', () => {
    expect(durationChartHeight(500)).toBe(500 * ROW_HEIGHT);
    expect(Number.isFinite(durationChartHeight(500))).toBe(true);
  });
});
