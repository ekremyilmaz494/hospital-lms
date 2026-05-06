import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/training-periods
 *
 * Personelin organizasyonuna ait eğitim dönemlerini listeler.
 * Geçmiş dönem görüntüleme için frontend dropdown'ına veri sağlar.
 */
export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  try {
    const periods = await prisma.trainingPeriod.findMany({
      where: { organizationId },
      select: { id: true, label: true, year: true, status: true, isDefault: true },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    })

    return jsonResponse(
      { periods },
      200,
      { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    )
  } catch (err) {
    logger.error('StaffTrainingPeriods GET', 'Dönemler alınamadı', { err, userId: dbUser.id })
    return errorResponse('Eğitim dönemleri alınırken hata oluştu', 500)
  }
}, { requireOrganization: true })
