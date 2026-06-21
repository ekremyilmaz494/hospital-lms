/**
 * Leitner spaced-repetition saf mantığı (oyunlaştırma Faz 1).
 *
 * Kutu 0..5. Doğru cevap kutuyu +1 (tavan {@link MAX_BOX}), yanlış cevap kutu 0.
 * Bir sonraki tekrar tarihi kutu aralığına ({@link LEITNER_INTERVALS}) göre
 * Istanbul gün-sonu olarak hesaplanır. Bu fonksiyonlar yan etkisizdir (test'lenebilir).
 */

import { LEITNER_INTERVALS, MAX_BOX } from './constants'
import { istanbulAddDaysEndOfDayUTC } from './timezone'

/** Cevap sonucuna göre yeni Leitner kutusu. Doğru → +1 (tavan), yanlış → 0. */
export function nextBox(oldBox: number, isCorrect: boolean): number {
  if (!isCorrect) return 0
  return Math.min(oldBox + 1, MAX_BOX)
}

/**
 * Verilen kutu için bir sonraki tekrar tarihi (UTC `Date`, Istanbul gün-sonu).
 * Kutu aralık tablosu dışına taşan değerler 0..MAX_BOX'a clamp'lenir.
 */
export function dueDateForBox(box: number, from: Date = new Date()): Date {
  const safeBox = Math.max(0, Math.min(box, MAX_BOX))
  return istanbulAddDaysEndOfDayUTC(from, LEITNER_INTERVALS[safeBox])
}
