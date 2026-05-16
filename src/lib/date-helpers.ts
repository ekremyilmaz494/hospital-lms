/**
 * Tarih yardımcıları — eğitim / sınav / sertifika gibi domain'lerde
 * "son tarih" semantiği için.
 *
 * **Neden gerekli:** Admin form'da `<input type="date">` "2026-05-16" stringi
 * üretir, browser ISO'ya çevirdiğinde `2026-05-16T00:00:00.000Z` olur (UTC gece
 * yarısı = günün BAŞI). Eğitim son tarih "16 Mayıs" olarak girildiğinde personel
 * o günün sonuna kadar erişebilmeli; aksi halde gün doğmadan kapanmış olur.
 *
 * `toEndOfDayUTC` input tarihinin UTC günü sonunu (23:59:59.999) döner; hem
 * create/update sırasında normalize için hem de eski veriler için read-side
 * defense-in-depth karşılaştırması için kullanılır.
 */

export function toEndOfDayUTC(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : new Date(input.getTime())
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** Bir Date'in o günün son anına ait olduğunu kontrol et (UTC). */
export function isAtEndOfDayUTC(d: Date): boolean {
  return d.getUTCHours() === 23 && d.getUTCMinutes() === 59 && d.getUTCSeconds() === 59
}

/**
 * `endDate`'i karşılaştırma için "gün sonu"na normalize ederek expired olup
 * olmadığını döndürür. DB'de eski kayıtlar (gün başı saatli) için de doğru
 * sonuç verir; yeni kayıtlar zaten end-of-day kaydedildiği için no-op olur.
 */
export function isEndDatePassed(endDate: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!endDate) return false
  const eod = toEndOfDayUTC(endDate)
  return now > eod
}
