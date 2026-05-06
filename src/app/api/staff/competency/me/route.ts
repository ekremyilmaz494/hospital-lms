import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/competency/me
 *
 * Personelin kendi tamamlanmış yetkinlik değerlendirme sonuçlarını döner.
 * Kategori bazlı ağırlıklı puan + genel ortalama hesaplanır.
 */
export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  try {
    const evaluations = await prisma.competencyEvaluation.findMany({
      where: {
        subjectId: dbUser.id,
        status: 'COMPLETED',
        form: { organizationId },
      },
      select: {
        id: true,
        overallScore: true,
        completedAt: true,
        evaluatorType: true,
        form: {
          select: {
            id: true,
            title: true,
            periodEnd: true,
            categories: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                weight: true,
                items: {
                  select: { id: true, text: true },
                },
              },
            },
          },
        },
        answers: {
          select: {
            itemId: true,
            score: true,
            comment: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    })

    // Her evaluation için kategori bazlı ortalama hesapla
    const results = evaluations.map(ev => {
      const itemAnswerMap = new Map(ev.answers.map(a => [a.itemId, a.score]))

      const categories = ev.form.categories.map(cat => {
        const scores = cat.items
          .map(item => itemAnswerMap.get(item.id) ?? null)
          .filter((s): s is number => s !== null)
        const avg = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null
        return { id: cat.id, name: cat.name, weight: cat.weight, avgScore: avg }
      })

      return {
        id: ev.id,
        formId: ev.form.id,
        formTitle: ev.form.title,
        periodEnd: ev.form.periodEnd,
        evaluatorType: ev.evaluatorType,
        overallScore: ev.overallScore,
        completedAt: ev.completedAt,
        categories,
      }
    })

    return jsonResponse(
      { evaluations: results },
      200,
      { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    )
  } catch (err) {
    logger.error('StaffCompetencyMe GET', 'Yetkinlik sonuçları alınamadı', { err, userId: dbUser.id })
    return errorResponse('Yetkinlik sonuçları alınırken hata oluştu', 500)
  }
}, { requireOrganization: true })
