/**
 * Bir atamanın **etkin bitiş tarihi**ni hesaplar.
 *
 * Atamada `dueDate` override edilmişse o öncelikli (2. tur senaryosu).
 * Aksi halde training.endDate fallback (1. tur veya override edilmemiş atama).
 *
 * Exam start guard, reminder cron ve compliance hesabı bu tek yerden geçer.
 */
export function getEffectiveDueDate(
  assignment: { dueDate: Date | string | null },
  training: { endDate: Date | string },
): Date {
  return new Date(assignment.dueDate ?? training.endDate)
}
