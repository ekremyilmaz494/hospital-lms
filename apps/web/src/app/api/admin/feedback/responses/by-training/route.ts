import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/responses/by-training
 *
 * Yanıtları eğitim bazında toplulaştırır. Admin "Geri Bildirim Yanıtları"
 * sayfasının üst seviyesi: her eğitim için kart göster, tıklandığında flat
 * liste açılır. organizationId zorunlu (multi-tenant).
 *
 * Response:
 * {
 *   items: [
 *     {
 *       trainingId, trainingTitle, category,
 *       responseCount, passedCount, failedCount,
 *       lastResponseAt
 *     }
 *   ],
 *   total
 * }
 */
export const GET = withAdminRoute(async ({ dbUser, organizationId }) => {
  try {
    // Paralel: (1) toplam group, (2) geçti group, (3) ilgili training meta'ları.
    // Aynı tabloya iki groupBy — biri toplam count + lastResponseAt, biri passed=true count.
    const [totalGroups, passedGroups] = await Promise.all([
      prisma.trainingFeedbackResponse.groupBy({
        by: ['trainingId'],
        where: { organizationId },
        _count: { _all: true },
        _max: { submittedAt: true },
      }),
      prisma.trainingFeedbackResponse.groupBy({
        by: ['trainingId'],
        where: { organizationId, isPassed: true },
        _count: { _all: true },
      }),
    ])

    if (totalGroups.length === 0) {
      return jsonResponse({ items: [], total: 0 }, 200, {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      })
    }

    const trainingIds = totalGroups.map(g => g.trainingId)
    const trainings = await prisma.training.findMany({
      where: { id: { in: trainingIds } },
      select: { id: true, title: true, category: true },
    })

    const titleById = new Map(trainings.map(t => [t.id, t]))
    const passedById = new Map(passedGroups.map(g => [g.trainingId, g._count._all]))

    const items = totalGroups
      .map(g => {
        const meta = titleById.get(g.trainingId)
        const responseCount = g._count._all
        const passedCount = passedById.get(g.trainingId) ?? 0
        return {
          trainingId: g.trainingId,
          trainingTitle: meta?.title ?? '— silinmiş eğitim',
          category: meta?.category ?? null,
          responseCount,
          passedCount,
          failedCount: responseCount - passedCount,
          lastResponseAt: g._max.submittedAt,
        }
      })
      // Son yanıt tarihine göre azalan — en aktif eğitimler üstte
      .sort((a, b) => {
        const at = a.lastResponseAt?.getTime() ?? 0
        const bt = b.lastResponseAt?.getTime() ?? 0
        return bt - at
      })

    return jsonResponse({ items, total: items.length }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (err) {
    logger.error('AdminFeedbackByTraining GET', 'Aggregate hatası', { err, userId: dbUser.id })
    return errorResponse('Eğitim bazlı yanıt özeti yüklenemedi', 500)
  }
}, { requireOrganization: true })
