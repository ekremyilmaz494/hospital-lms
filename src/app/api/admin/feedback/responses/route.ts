import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, requireRole, safePagination } from '@/lib/api-helpers'
import { calculateOverallScore, type FeedbackQuestionType } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/responses
 *
 * Query:
 *   - page, limit — sayfalama
 *   - trainingId — tek eğitime filtrele
 *   - dateFrom, dateTo — ISO8601 tarih aralığı
 *   - isPassed — "true" | "false" — geçti/kaldı filtresi
 *
 * Dönüş: her response'un özet bilgisi + calculated overallScore (likert avg).
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)
  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const url = new URL(request.url)
  const { page, limit, skip } = safePagination(url.searchParams, 100)
  const trainingId = url.searchParams.get('trainingId') || undefined
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')
  const isPassedParam = url.searchParams.get('isPassed')
  const isPassed = isPassedParam === 'true' ? true : isPassedParam === 'false' ? false : undefined

  const where = {
    organizationId: dbUser.organizationId,
    ...(trainingId ? { trainingId } : {}),
    ...(isPassed !== undefined ? { isPassed } : {}),
    ...(dateFrom || dateTo
      ? {
          submittedAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  try {
    const [total, responses] = await Promise.all([
      prisma.trainingFeedbackResponse.count({ where }),
      prisma.trainingFeedbackResponse.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          includeName: true,
          isPassed: true,
          submittedAt: true,
          training: { select: { id: true, title: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentRel: { select: { id: true, name: true } },
            },
          },
          answers: {
            select: {
              score: true,
              itemSnapshot: true,
              item: { select: { questionType: true } },
            },
          },
        },
      }),
    ])

    const items = responses.map(r => {
      const overall = calculateOverallScore(
        r.answers.map(a => {
          // Snapshot öncelikli — item silinse bile questionType kaybolmaz.
          const snap = a.itemSnapshot as { questionType?: string } | null
          const qt = (snap?.questionType ?? a.item?.questionType ?? 'text') as FeedbackQuestionType
          return { score: a.score, questionType: qt }
        }),
      )
      return {
        id: r.id,
        submittedAt: r.submittedAt,
        isPassed: r.isPassed,
        trainingId: r.training.id,
        trainingTitle: r.training.title,
        participant: r.includeName && r.user
          ? {
              id: r.user.id,
              name: `${r.user.firstName} ${r.user.lastName}`.trim(),
              departmentId: r.user.departmentRel?.id ?? null,
              departmentName: r.user.departmentRel?.name ?? null,
            }
          : null,
        overallScore: overall,
      }
    })

    return jsonResponse({ items, total, page, limit }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (err) {
    logger.error('AdminFeedbackResponses GET', 'Listeleme hatası', { err, userId: dbUser.id })
    return errorResponse('Yanıtlar yüklenemedi', 500)
  }
}
