import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getAllPendingFeedback } from '@/lib/feedback-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/feedback/pending
 *
 * Personelin bekleyen tüm geri bildirimlerini döner — zorunlu + opsiyonel.
 * `/api/staff/pending-mandatory-feedback` (banner için tekil) ile farkı:
 *  - Bu endpoint LİSTE döner; staff/feedback sayfası tüketir
 *  - Mandatory filtresi yok; her ikisini de kapsar (UI ayrıştırır)
 *
 * Form per organization tek; form aktif değilse veya yoksa boş liste +
 * `formActive: false` döner — UI "şu an form yapılandırılmamış" mesajı verir.
 */
export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  try {
    const [items, form] = await Promise.all([
      getAllPendingFeedback(dbUser.id),
      prisma.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true },
        select: { id: true },
      }),
    ])

    return jsonResponse(
      { items, formActive: form !== null },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('StaffFeedbackPending GET', 'Liste alınamadı', { err, userId: dbUser.id })
    return errorResponse('Bekleyen geri bildirimler alınırken hata oluştu', 500)
  }
}, { requireOrganization: true })
