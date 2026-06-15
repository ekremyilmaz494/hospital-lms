import { describe, it, expect } from 'vitest';
import {
  computeTimeoutMs,
  computeMaxRetries,
  MAX_FUNCTION_DURATION_MS,
} from '@/lib/openrouter-budget';

/**
 * AI soru üretimi timeout bütçesi regresyon testi.
 *
 * Kritik değişmez: timeout × (retry+1) < Vercel function maxDuration (300s).
 * Aksi halde SDK retry'ları stack'lenip function'ı erken kestirir → 504 →
 * "İşlem zaman aşımına uğradı" hatası. Bu test o regresyonu engeller.
 */
describe('openrouter timeout budget', () => {
  it('20 soruluk büyük çağrı eski 60s sabitinden bol bütçe alır', () => {
    expect(computeTimeoutMs(20)).toBe(200_000);
    expect(computeTimeoutMs(20)).toBeGreaterThan(60_000);
  });

  it('tek soru (replenish) makul bütçe alır', () => {
    expect(computeTimeoutMs(1)).toBe(58_000);
  });

  it('büyük çağrıda retry kapalı, küçük çağrıda 1 retry', () => {
    expect(computeMaxRetries(20)).toBe(0);
    expect(computeMaxRetries(10)).toBe(0);
    expect(computeMaxRetries(9)).toBe(1);
    expect(computeMaxRetries(1)).toBe(1);
  });

  it('DEĞİŞMEZ: timeout × (retry+1) her zaman maxDuration altında kalır', () => {
    for (let count = 1; count <= 20; count++) {
      const worstCase = computeTimeoutMs(count) * (computeMaxRetries(count) + 1);
      expect(worstCase).toBeLessThan(MAX_FUNCTION_DURATION_MS);
    }
  });
});
