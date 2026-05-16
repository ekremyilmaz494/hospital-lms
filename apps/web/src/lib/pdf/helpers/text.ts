/**
 * PDF metin yardımcıları.
 *
 * Türkçe karakter stratejisi:
 *   jsPDF'in default Helvetica fontu Unicode desteklemez ("ğüşçöı" yerine "?" çizer).
 *   Font embed (Roboto TTF ~340KB) yerine ASCII-safe transliterasyon kullanıyoruz —
 *   denetim raporunda okunaklılık önemli, görsel aksan kaybı akreditasyon için kritik değil.
 *   İleride premium tier'a Roboto embed eklemek için bu katman soyut.
 */

const TR_MAP: Record<string, string> = {
  'ğ': 'g', 'Ğ': 'G',
  'ü': 'u', 'Ü': 'U',
  'ş': 's', 'Ş': 'S',
  'ç': 'c', 'Ç': 'C',
  'ö': 'o', 'Ö': 'O',
  'ı': 'i', 'İ': 'I',
  // Türkçe dışı diakritik (opsiyonel)
  'â': 'a', 'Â': 'A',
  'î': 'i', 'Î': 'I',
  'û': 'u', 'Û': 'U',
}

/** Türkçe karakterleri ASCII'ye çevir (jsPDF Helvetica uyumlu). */
export function tr(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/[ğĞüÜşŞçÇöÖıİâÂîÎûÛ]/g, (c) => TR_MAP[c] ?? c)
}

/** Türkçe tarih formatı: "14 Nisan 2026". */
export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return tr(d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }))
}

/** Kısa Türkçe tarih: "14.04.2026". */
export function formatDateShort(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Metni belirli karakter sayısıyla kısalt (ellipsis ile). */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.substring(0, max - 1).trimEnd() + '…'
}

/** Yüzde formatı (1 ondalık). */
export function formatPercent(value: number): string {
  return `%${Number(value).toFixed(1).replace('.0', '')}`
}
