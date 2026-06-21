import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { DAILY_QUESTION_LIMIT } from '@/lib/gamification/constants'
import { istanbulDateString, istanbulEndOfDayUTC } from '@/lib/gamification/timezone'

const CACHE_CONTROL = 'private, max-age=30, stale-while-revalidate=60'

/**
 * GET /api/staff/daily/questions — Günün soruları (Leitner spaced-repetition).
 *
 * Personelin o gün tekrar etmesi gereken (due) sorularını döner. Due seçimini
 * SUNUCU yapar (anti-cheat). Doğru cevap (`isCorrect`) ASLA sızdırılmaz.
 * GET'te DB write YOK — havuz seeding `cron/daily-quiz-push`'ta yapılır.
 */
export const GET = withStaffRoute(
  async ({ dbUser }) => {
    const now = new Date()
    const serverDate = istanbulDateString(now)
    const dueUntil = istanbulEndOfDayUTC(now)

    const dueWhere = { userId: dbUser.id, nextReviewAt: { lte: dueUntil } }
    const [due, dueCount] = await Promise.all([
      prisma.dailyReview.findMany({
        where: dueWhere,
        orderBy: { nextReviewAt: 'asc' },
        take: DAILY_QUESTION_LIMIT,
        select: { questionId: true, box: true },
      }),
      prisma.dailyReview.count({ where: dueWhere }),
    ])

    if (due.length === 0) {
      return jsonResponse(
        { available: false, dueCount: 0, serverDate, questions: [] },
        200,
        { 'Cache-Control': CACHE_CONTROL },
      )
    }

    const boxByQuestion = new Map(due.map((d) => [d.questionId, d.box]))
    const questions = await prisma.question.findMany({
      where: { id: { in: due.map((d) => d.questionId) } },
      select: {
        id: true,
        questionText: true,
        // isCorrect SELECT EDİLMEZ — mobile asla doğru cevabı sızdırma.
        options: {
          select: { id: true, optionText: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    // Due sırasını koru (findMany `id: { in }` sırası garanti değildir).
    const questionById = new Map(questions.map((q) => [q.id, q]))
    const payload = due
      .map((d) => questionById.get(d.questionId))
      .filter((q): q is NonNullable<typeof q> => q != null)
      .map((q) => ({
        questionId: q.id,
        prompt: q.questionText,
        box: boxByQuestion.get(q.id) ?? 0,
        options: q.options.map((o) => ({ optionId: o.id, text: o.optionText })),
      }))

    return jsonResponse(
      { available: true, dueCount, serverDate, questions: payload },
      200,
      { 'Cache-Control': CACHE_CONTROL },
    )
  },
  { requireOrganization: true },
)
