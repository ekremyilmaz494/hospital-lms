/**
 * EY.FR.40 Eğitim Geri Bildirim — yardımcı fonksiyonlar
 *
 * Analytics aggregation ve validation utility'leri. API route'lardan çağrılır.
 */

export type FeedbackQuestionType = 'likert_5' | 'yes_partial_no' | 'text'

/**
 * Soru tipine göre bir cevabın geçerli olup olmadığını kontrol eder.
 * Server-side input validation ile birlikte kullanılır.
 */
export function isValidAnswer(
  questionType: FeedbackQuestionType,
  isRequired: boolean,
  answer: { score?: number | null; textAnswer?: string | null } | undefined,
): boolean {
  if (!answer) return !isRequired

  switch (questionType) {
    case 'likert_5':
      if (typeof answer.score !== 'number') return !isRequired
      return answer.score >= 1 && answer.score <= 5
    case 'yes_partial_no':
      if (typeof answer.score !== 'number') return !isRequired
      return answer.score >= 1 && answer.score <= 3
    case 'text':
      if (isRequired) {
        return typeof answer.textAnswer === 'string' && answer.textAnswer.trim().length > 0
      }
      return true
  }
}

export const YES_PARTIAL_NO_LABELS: Record<number, string> = {
  1: 'Evet',
  2: 'Kısmen',
  3: 'Hayır',
}

export const LIKERT_5_LABELS: Record<number, string> = {
  1: 'Çok Zayıf',
  2: 'Zayıf',
  3: 'Orta',
  4: 'İyi',
  5: 'Çok İyi',
}

/**
 * Response set üzerinden item bazında ortalama skor hesaplar.
 * Sadece `likert_5` ve `yes_partial_no` için anlamlı — `text` tipi atlanır.
 */
export function aggregateItemScores(
  answers: Array<{ itemId: string; score: number | null; questionType: FeedbackQuestionType }>,
): Map<string, { avg: number; count: number }> {
  const byItem = new Map<string, { sum: number; count: number }>()
  for (const a of answers) {
    if (a.questionType === 'text') continue
    if (a.score == null) continue
    const entry = byItem.get(a.itemId) ?? { sum: 0, count: 0 }
    entry.sum += a.score
    entry.count += 1
    byItem.set(a.itemId, entry)
  }

  const result = new Map<string, { avg: number; count: number }>()
  for (const [itemId, { sum, count }] of byItem) {
    result.set(itemId, {
      avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      count,
    })
  }
  return result
}

/**
 * Bir response'un genel ortalama puanını hesaplar (sadece likert_5 sorularından).
 * Admin response listesinde "Genel Puan" kolonu için kullanılır.
 */
export function calculateOverallScore(
  answers: Array<{ score: number | null; questionType: FeedbackQuestionType }>,
): number | null {
  const likertScores = answers
    .filter(a => a.questionType === 'likert_5' && typeof a.score === 'number')
    .map(a => a.score as number)

  if (likertScores.length === 0) return null
  const sum = likertScores.reduce((acc, s) => acc + s, 0)
  return Math.round((sum / likertScores.length) * 100) / 100
}
