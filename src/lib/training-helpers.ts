/**
 * Training (eğitim) varlıkları için paylaşılan helper'lar.
 *
 * Multi-tenant arşivli eğitim filter konvansiyonunun tek doğruluk kaynağı:
 * Arşivlenmiş veya pasif eğitimlere yeni sınav/feedback açılmaz. Bu helper
 * üç farklı API route'unda (feedback submit, exam start, staff certificates)
 * tekrar eden `!isActive || publishStatus === 'archived'` kontrolünü birleştirir.
 *
 * @see feedback_archived_training_filter konvansiyonu
 */

/**
 * Training'in kullanıcıya erişilebilir olup olmadığını kontrol eder.
 *
 * Bir eğitim şu iki durumdan birinde ise erişilemez:
 *   - `isActive` false (soft-disabled)
 *   - `publishStatus === 'archived'` (arşivlenmiş)
 *
 * Çağıranlar bu fonksiyonun dönüşüne göre kendi route'una özgü
 * error mesajı ve status code ile `errorResponse` döndürür.
 *
 * @param training - Gerekli alanları seçilmiş (select) training kaydı
 * @returns `true` eğer eğitim aktif ve arşivlenmemişse
 */
export function isTrainingAccessible(training: {
  isActive: boolean
  publishStatus: string
}): boolean {
  return training.isActive && training.publishStatus !== 'archived'
}
