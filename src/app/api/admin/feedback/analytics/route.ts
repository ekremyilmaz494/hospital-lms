import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, requireRole } from '@/lib/api-helpers'
import { aggregateItemScores, type FeedbackQuestionType } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/analytics
 *
 * Query:
 *   - trainingId — belirli eğitim (opsiyonel)
 *   - dateFrom, dateTo — tarih aralığı
 *
 * Dönüş:
 *   - totalResponses
 *   - passedCount / failedCount
 *   - overallAverage (tüm likert_5 cevapların ortalaması)
 *   - recommendationRate (yes_partial_no → Evet yüzdesi)
 *   - categories: [{ categoryId, categoryName, avgScore, itemCount, items: [{itemId, text, avg, count}] }]
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)
  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const url = new URL(request.url)
  const trainingId = url.searchParams.get('trainingId') || undefined
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')

  const where = {
    organizationId: dbUser.organizationId,
    ...(trainingId ? { trainingId } : {}),
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
    // Tek sorguda: response'lar + answer + item(kategori ile)
    // Paralel: summary + detail
    const [summary, form] = await Promise.all([
      prisma.trainingFeedbackResponse.groupBy({
        by: ['isPassed'],
        where,
        _count: { _all: true },
      }),
      prisma.trainingFeedbackForm.findUnique({
        where: { organizationId: dbUser.organizationId },
        select: {
          id: true,
          categories: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              items: {
                orderBy: { order: 'asc' },
                select: { id: true, text: true, questionType: true, order: true },
              },
            },
          },
        },
      }),
    ])

    if (!form) {
      return jsonResponse({
        totalResponses: 0, passedCount: 0, failedCount: 0,
        overallAverage: null, recommendationRate: null, categories: [],
      })
    }

    const passedCount = summary.find(s => s.isPassed)?._count._all ?? 0
    const failedCount = summary.find(s => !s.isPassed)?._count._all ?? 0
    const totalResponses = passedCount + failedCount

    if (totalResponses === 0) {
      return jsonResponse({
        totalResponses: 0, passedCount: 0, failedCount: 0,
        overallAverage: null, recommendationRate: null,
        categories: form.categories.map(c => ({
          categoryId: c.id, categoryName: c.name, avgScore: null,
          items: c.items.map(i => ({
            itemId: i.id, text: i.text, questionType: i.questionType, avg: null, count: 0,
          })),
        })),
      })
    }

    // Tüm answer'ları aggregate için çek.
    // itemId null olabilir (item silindikten sonra) — snapshot fallback'i
    // questionType'ı korur, ama itemId-bazlı aggregation'a giremez (hangi
    // item'a ait bilinmiyor artık). Overall/recommendation hesapları için
    // snapshot yeterli.
    const answers = await prisma.trainingFeedbackAnswer.findMany({
      where: { response: where },
      select: {
        itemId: true,
        score: true,
        itemSnapshot: true,
        item: { select: { questionType: true, categoryId: true } },
      },
    })

    const answersWithType = answers.map(a => {
      const snap = a.itemSnapshot as { questionType?: string } | null
      const qt = (snap?.questionType ?? a.item?.questionType ?? 'text') as FeedbackQuestionType
      return {
        itemId: a.itemId, // null olabilir
        score: a.score,
        questionType: qt,
      }
    })

    // Item-bazlı aggregation: silinmiş itemlar (itemId=null) kategoriye
    // bağlanamaz, bu yüzden kategori detayından dışlanır. Overall/recommendation
    // ise tüm cevaplar üzerinden hesaplanır (aşağıda).
    const itemAggregates = aggregateItemScores(
      answersWithType
        .filter((a): a is typeof a & { itemId: string } => a.itemId !== null)
        .map(a => ({ itemId: a.itemId, score: a.score, questionType: a.questionType })),
    )

    // Kategori bazında birleştir
    const categories = form.categories.map(cat => {
      const itemStats = cat.items.map(item => {
        const agg = itemAggregates.get(item.id)
        return {
          itemId: item.id,
          text: item.text,
          questionType: item.questionType,
          avg: agg?.avg ?? null,
          count: agg?.count ?? 0,
        }
      })

      // Kategori ortalaması: item avg'lerin likert_5 olanların ortalaması
      const categoryAvgSource = itemStats
        .filter(i => i.questionType === 'likert_5' && i.avg !== null)
        .map(i => i.avg as number)
      const avgScore = categoryAvgSource.length > 0
        ? Math.round((categoryAvgSource.reduce((s, v) => s + v, 0) / categoryAvgSource.length) * 100) / 100
        : null

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        avgScore,
        items: itemStats,
      }
    })

    // Genel ortalama (tüm likert_5 cevapların)
    const likertScores = answersWithType
      .filter(a => a.questionType === 'likert_5' && a.score !== null)
      .map(a => a.score as number)
    const overallAverage = likertScores.length > 0
      ? Math.round((likertScores.reduce((s, v) => s + v, 0) / likertScores.length) * 100) / 100
      : null

    // Tavsiye oranı (yes_partial_no → score=1 Evet)
    const recommendationAnswers = answersWithType.filter(a => a.questionType === 'yes_partial_no' && a.score !== null)
    const yesCount = recommendationAnswers.filter(a => a.score === 1).length
    const recommendationRate = recommendationAnswers.length > 0
      ? Math.round((yesCount / recommendationAnswers.length) * 1000) / 10
      : null

    return jsonResponse({
      totalResponses,
      passedCount,
      failedCount,
      overallAverage,
      recommendationRate,
      categories,
    }, 200, {
      'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
    })
  } catch (err) {
    logger.error('FeedbackAnalytics GET', 'Analitik hatası', { err, userId: dbUser.id })
    return errorResponse('Analitik verisi alınamadı', 500)
  }
}
