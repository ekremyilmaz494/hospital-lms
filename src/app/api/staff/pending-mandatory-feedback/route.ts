import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getPendingMandatoryFeedback } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/pending-mandatory-feedback
 *
 * Kullanıcının bekleyen zorunlu geri bildirim'i var mı? Dashboard + my-trainings
 * banner'ları bu endpoint'i çağırır. Yeni eğitim başlatmayı client-side'da
 * preemptive engellemek için de kullanılır (aksi halde 423 Locked döner).
 */
export const GET = withStaffRoute(async ({ dbUser }) => {
  try {
    const pending = await getPendingMandatoryFeedback(dbUser.id)
    return jsonResponse(
      { pending },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  } catch (err) {
    logger.error('PendingMandatoryFeedback GET', 'Kontrol başarısız', { err, userId: dbUser.id })
    return errorResponse('Durum kontrol edilirken hata oluştu', 500)
  }
}, { requireOrganization: true })
