import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * Normalize TrainingAssignment.status → UI status.
 * DB 'passed' iş kuralında "başarıyla tamamlandı" demek; UI katmanı bunu 'completed' olarak görür.
 * Böylece UI'da her yerde status kıyaslaması tutarlı olur.
 */
type CalendarStatus = 'assigned' | 'in_progress' | 'completed' | 'failed' | 'locked'

function normalizeStatus(raw: string): CalendarStatus {
  if (raw === 'passed') return 'completed'
  if (
    raw === 'assigned' ||
    raw === 'in_progress' ||
    raw === 'completed' ||
    raw === 'failed' ||
    raw === 'locked'
  ) {
    return raw
  }
  return 'assigned'
}

export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  // ?month=YYYY-MM → o ayı kapsayan atamalar. Yoksa -3 / +6 ay pencere (navigasyon için).
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')

  let rangeStart: Date
  let rangeEnd: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    rangeStart = new Date(y, m - 1, 1)
    rangeEnd = new Date(y, m, 0, 23, 59, 59, 999)
  } else {
    const now = new Date()
    rangeStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    rangeEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59, 999)
  }

  try {
    // my-trainings ile aynı görünürlük kuralı: arşivli / pasif eğitim gösterme.
    // Aksi halde staff tıklayamayacağı (404 dönen) eğitim görür.
    const where = {
      userId: dbUser.id,
      training: {
        organizationId,
        isActive: true,
        publishStatus: { not: 'archived' },
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
    }

    const assignments = await prisma.trainingAssignment.findMany({
      where,
      select: {
        id: true,
        status: true,
        training: {
          select: {
            id: true,
            title: true,
            category: true,
            startDate: true,
            endDate: true,
            examOnly: true,
          },
        },
      },
      // Takvim ay-bazlı görüntülüyor; tek pencere için 500 üst sınır pratikte yeterli.
      take: 500,
    })

    const events = assignments.map(a => ({
      id: a.id,
      title: a.training.title,
      start: a.training.startDate.toISOString(),
      end: a.training.endDate.toISOString(),
      category: a.training.category,
      status: normalizeStatus(a.status),
      trainingId: a.training.id,
      eventType: a.training.examOnly ? ('exam' as const) : ('training' as const),
    }))

    return jsonResponse(
      { events, total: events.length },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }
    )
  } catch (err) {
    logger.error('Staff Calendar', 'Takvim yüklenemedi', err)
    return errorResponse('Takvim yüklenemedi', 503)
  }
}, { requireOrganization: true })
