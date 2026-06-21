/**
 * Europe/Istanbul gün-sınırı yardımcıları (oyunlaştırma).
 *
 * **Neden gerekli:** Günün Soruları (spaced-repetition) ve `serverDate` kurum
 * saatine göre hesaplanmalı. Mevcut `date-helpers.ts` UTC gün-sonu üretir; bu
 * Istanbul 00:00–03:00 arasında bir önceki güne kayar (due soru kaçar / yanlış
 * gün). Bu modül tüm gün hesaplarını Istanbul takvim gününe sabitler.
 *
 * Türkiye 2016'dan beri DST kullanmaz (sabit UTC+3), ama ofset `Intl` üzerinden
 * dinamik türetilir — DST'ye dönerse kod kırılmaz. Yeni dependency yok.
 */

const TZ = 'Europe/Istanbul'

/** Verilen anın Istanbul takvim gününü `"YYYY-MM-DD"` olarak döndürür. */
export function istanbulDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Ofset parse edilemezse Türkiye'nin sabit ofseti (UTC+3, dakika). */
const ISTANBUL_FALLBACK_OFFSET_MIN = 180

/**
 * `d` anında Istanbul'un UTC'ye göre ofsetini dakika cinsinden döndürür
 * (UTC + ofset = yerel saat). Türkiye için +180; DST'ye dönerse doğru kalır.
 * `longOffset` (örn. "GMT+03:00") parse edilir — gece-yarısı saat quirk'i yoktur.
 */
function istanbulOffsetMinutes(d: Date): number {
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'longOffset',
  })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value

  const m = tzName?.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return ISTANBUL_FALLBACK_OFFSET_MIN
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0))
}

/**
 * `d`'nin ait olduğu Istanbul gününün SONUNU (yerel 23:59:59.999) UTC `Date`
 * olarak döndürür. "Due" penceresi (`nextReviewAt <= bugün-sonu`) ve serverDate
 * karşılaştırmaları için kanonik üst sınır.
 */
export function istanbulEndOfDayUTC(d: Date): Date {
  const [y, m, day] = istanbulDateString(d).split('-').map(Number)
  const offset = istanbulOffsetMinutes(d)
  // Yerel 23:59:59.999'u UTC'ye çevir: UTC sanıp ofseti çıkar.
  const utcMs = Date.UTC(y, m - 1, day, 23, 59, 59, 999) - offset * 60000
  return new Date(utcMs)
}

/**
 * `from`'dan `days` gün sonrasının Istanbul gün-sonunu UTC `Date` olarak döndürür.
 * Leitner aralık hesabı (`nextReviewAt`) için. `days=0` → bugünün sonu (hemen due).
 */
export function istanbulAddDaysEndOfDayUTC(from: Date, days: number): Date {
  const base = istanbulEndOfDayUTC(from)
  const shifted = new Date(base.getTime() + days * 86_400_000)
  // DST'ye karşı yeniden normalize et (Türkiye'de no-op).
  return istanbulEndOfDayUTC(shifted)
}

// ── Takvim-günü (DATE) aritmetiği — streak hesapları için (TZ-bağımsız) ──

/** `"YYYY-MM-DD"` stringine gün ekler/çıkarır, `"YYYY-MM-DD"` döner. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

/** `"YYYY-MM-DD"` → UTC gece-yarısı Date (Prisma `@db.Date` yazımı için). */
export function dateStringToUTCDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/** Prisma `@db.Date` (UTC gece-yarısı Date) → `"YYYY-MM-DD"`. */
export function utcDateToDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
