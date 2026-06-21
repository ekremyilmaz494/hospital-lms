/**
 * Oyunlaştırma Faz 1 — Günün Soruları (spaced-repetition) sabitleri.
 *
 * Magic number yasağı (CLAUDE.md): Leitner aralıkları, puan değerleri ve
 * limitler tek noktada. SMG sisteminden TAMAMEN ayrıdır.
 */

/**
 * Leitner kutu → tekrar aralığı (gün). Kutu 0..5. Doğru cevap kutuyu +1 (tavan 5),
 * yanlış cevap kutu 0'a düşürür. Mobil ile SENKRON olmalı.
 */
export const LEITNER_INTERVALS = [0, 1, 3, 7, 16, 35] as const

/** En üst Leitner kutusu (tavan). */
export const MAX_BOX = 5

/** Puan değerleri. Faz 1: doğru cevap; Faz 3: olay puanları. */
export const POINTS = {
  dailyReviewCorrect: 10,
  examPass: 50,
  trainingComplete: 30,
  feedbackSubmit: 15,
} as const

/** `/gamification/event` rate limit (kullanıcı başına). */
export const GAMI_EVENT_RATE_LIMIT = { max: 60, windowSeconds: 3600 } as const

/** Bir oturumda dönen/işlenen maksimum due soru sayısı. */
export const DAILY_QUESTION_LIMIT = 20

/** `/daily/submit` rate limit (kullanıcı başına). */
export const DAILY_SUBMIT_RATE_LIMIT = { max: 30, windowSeconds: 3600 } as const

/** Faz 2 — yeni kullanıcı streak'ine verilen varsayılan freeze (gün atlama) hakkı. */
export const STREAK_FREEZES_DEFAULT = 2

/** `point_ledger.event_type` değerleri (Faz 1: daily_review; Faz 3: diğerleri). */
export const POINT_EVENT = {
  dailyReview: 'daily_review',
  examPass: 'exam_pass',
  trainingComplete: 'training_complete',
  feedbackSubmit: 'feedback_submit',
} as const

/** Mobil deep-link prefix'i — push payload `data.url` bunu bekler. */
export const DAILY_QUIZ_DEEPLINK = '/daily-quiz'

/** Cron seed/push batch boyutları. */
export const CRON_PUSH_BATCH = 500
export const CRON_SEED_INSERT_BATCH = 1000
