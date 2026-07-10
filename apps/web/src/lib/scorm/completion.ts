/**
 * Sunucu-tarafı SCORM tamamlama/geçme kararı — SÜRÜMDEN BAĞIMSIZ.
 *
 * Kritik: SCORM 1.2 içeriği `cmi.core.lesson_status` gönderir; SCORM 2004 içeriği
 * ise `lesson_status`'u HİÇ göndermez — bunun yerine `cmi.completion_status` +
 * `cmi.success_status` gönderir. Tamamlama kararını yalnız `lessonStatus`'a bağlamak
 * 2004 paketlerinin tamamlanmasını sunucuda görünmez kılar (assignment 'atandı'da
 * kalır, sertifika üretilmez). Bu helper her iki sürümü de kapsar.
 *
 * Kurallar:
 *  - Açık başarısızlık (1.2 lesson_status='failed' VEYA 2004 success_status='failed')
 *    → geçiş YOK (öncelikli guard).
 *  - SCORM 1.2: lesson_status ∈ {passed, completed} → geçti.
 *  - SCORM 2004: success_status='passed' VEYA completion_status='completed' → geçti
 *    (mevcut 1.2 'completed' leniency'siyle tutarlı; başarısızlık yukarıda elenir).
 */
export function isScormPassed(fields: {
  lessonStatus?: string | null
  completionStatus?: string | null
  successStatus?: string | null
}): boolean {
  const lesson = (fields.lessonStatus ?? '').toLowerCase().trim()
  const completion = (fields.completionStatus ?? '').toLowerCase().trim()
  const success = (fields.successStatus ?? '').toLowerCase().trim()

  // Açık başarısızlık → geçiş yok (hangi sürüm olursa olsun).
  if (lesson === 'failed' || success === 'failed') return false

  // SCORM 1.2
  if (lesson === 'passed' || lesson === 'completed') return true

  // SCORM 2004
  if (success === 'passed') return true
  if (completion === 'completed') return true

  return false
}
