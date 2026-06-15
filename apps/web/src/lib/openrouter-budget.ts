/**
 * AI soru üretimi zaman aşımı bütçesi — saf hesaplama (bağımlılıksız).
 *
 * Ayrı modül: prisma/s3 gibi ağır importları çekmeden test edilebilsin
 * (openrouter.ts bunları re-export eder).
 *
 * Kritik değişmez: `computeTimeoutMs(count) × (computeMaxRetries(count) + 1)`
 * her zaman MAX_FUNCTION_DURATION_MS altında kalmalı. Aksi halde OpenAI SDK
 * retry'ları stack'lenip Vercel function'ı erken kestirir → 504 → "İşlem zaman
 * aşımına uğradı" hatası.
 */

/** Vercel function maxDuration üst sınırı — timeout bütçesi bunu aşmamalı. */
export const MAX_FUNCTION_DURATION_MS = 300_000;

/**
 * İstek zaman aşımı bütçesi soru sayısına göre ölçeklenir.
 *
 * Eski sabit 60s, 20 soruyu büyük PDF'lerden üretirken (Claude native PDF parse)
 * rahatça aşılıyordu. Şimdi: count=20 → 200s, count=1 → 58s.
 */
export const computeTimeoutMs = (count: number): number =>
  Math.min(200_000, 50_000 + count * 8_000);

/**
 * Büyük çağrılarda (≥10 soru) retry kapalı: stack'lenen timeout maxDuration'ı
 * aşmasın. Küçük çağrılarda 1 retry (geçici 5xx/connection blip'i absorbe eder).
 */
export const computeMaxRetries = (count: number): number => (count >= 10 ? 0 : 1);
