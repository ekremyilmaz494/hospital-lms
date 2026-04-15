import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getPendingMandatoryFeedback } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/pending-mandatory-feedback
 *
 * Kullanıcının bekleyen zorunlu geri bildirim'i var mı? Dashboard + my-trainings
 * banner'ları bu endpoint'i çağırır. Yeni eğitim başlatmayı client-side'da
 * preemptive engellemek için de kullanılır (aksi halde 423 Locked döner).
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const pending = await getPendingMandatoryFeedback(dbUser.id)
    return jsonResponse(
      { pending },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('PendingMandatoryFeedback GET', 'Kontrol başarısız', { err, userId: dbUser.id })
    return errorResponse('Durum kontrol edilirken hata oluştu', 500)
  }
}
