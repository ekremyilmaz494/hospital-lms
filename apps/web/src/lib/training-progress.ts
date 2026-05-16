/**
 * Eğitim akışındaki ilerleme hesabı — TEK doğruluk kaynağı.
 *
 * Akış varyantları:
 *  - examOnly:     [post-exam]                  → 1 adım
 *  - retry (>1):   [videos, post-exam]          → 2 adım (pre-exam atlanır)
 *  - normal:       [pre-exam, videos, post-exam] → 3 adım
 *
 * Bu helper'ı kullanın: `staff/dashboard`, `staff/my-trainings`,
 * `staff/my-trainings/[id]` (detail). Aksi halde aynı assignment için
 * farklı ekranlarda farklı progress yüzdeleri görünür.
 */
export type TrainingProgressInput = {
  /** Training.examOnly */
  examOnly: boolean
  /** Latest attempt'in attemptNumber'ı (yoksa 0); >1 ise retry akışı */
  attemptNumber: number
  /** İsteğe bağlı override: true ise attemptNumber'a bakılmaksızın retry akışı zorlanır.
   *  Detail sayfası için: kullanıcı failed durumdan retry'a hazırlanırken
   *  henüz attempt #2 başlamamış olabilir ama UI retry görünmelidir. */
  needsRetry?: boolean
  preExamCompleted: boolean
  videosCompleted: boolean
  postExamCompleted: boolean
}

export type TrainingProgressResult = {
  completedSteps: number
  totalSteps: number
  /** 0-100 arası tam sayı */
  percent: number
  /** UI flag — retry mı normal mi gösterilsin */
  isRetry: boolean
  /** UI flag — examOnly mı normal mi gösterilsin */
  isExamOnly: boolean
}

export function calculateTrainingProgress(input: TrainingProgressInput): TrainingProgressResult {
  const { examOnly, attemptNumber, needsRetry, preExamCompleted, videosCompleted, postExamCompleted } = input
  const isRetry = !examOnly && (attemptNumber > 1 || needsRetry === true)

  let totalSteps: number
  let completedSteps: number

  if (examOnly) {
    totalSteps = 1
    completedSteps = postExamCompleted ? 1 : 0
  } else if (isRetry) {
    totalSteps = 2
    completedSteps = !videosCompleted ? 0 : !postExamCompleted ? 1 : 2
  } else {
    totalSteps = 3
    completedSteps = !preExamCompleted ? 0 : !videosCompleted ? 1 : !postExamCompleted ? 2 : 3
  }

  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  return { completedSteps, totalSteps, percent, isRetry, isExamOnly: examOnly }
}
