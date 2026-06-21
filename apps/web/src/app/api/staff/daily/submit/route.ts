import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import {
  DAILY_QUESTION_LIMIT,
  DAILY_SUBMIT_RATE_LIMIT,
  POINTS,
  POINT_EVENT,
} from '@/lib/gamification/constants'
import { nextBox, dueDateForBox } from '@/lib/gamification/leitner'
import { istanbulDateString } from '@/lib/gamification/timezone'
import { touchStreak } from '@/lib/gamification/streak'
import { evaluateBadges } from '@/lib/gamification/badges'

const submitSchema = z.object({
  submissionId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        optionId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(DAILY_QUESTION_LIMIT),
})

interface ReviewResult {
  questionId: string
  correct: boolean
  newBox: number
  nextReviewAt: string // "YYYY-MM-DD" (Istanbul)
}

interface SubmitResponse {
  correctCount: number
  pointsAwarded: number
  results: ReviewResult[]
}

/**
 * POST /api/staff/daily/submit — Günün soruları cevap gönderimi.
 *
 * - **Idempotent:** Aynı `submissionId` tekrar gelirse kredi BİR kez; snapshot'tan
 *   birebir aynı sonuç döner (offline replay için kritik).
 * - **Anti-cheat:** Doğru/yanlış SUNUCUDA `QuestionOption.isCorrect`'ten hesaplanır;
 *   mobilin gönderdiği bilgiye güvenilmez.
 * - Yalnız personelin havuzundaki (`DailyReview`) sorular işlenir — yeni soru
 *   seeding'i burada YAPILMAZ (cron'a aittir).
 */
export const POST = withStaffRoute(
  async ({ request, dbUser, organizationId }) => {
    const allowed = await checkRateLimit(
      `daily-submit:${dbUser.id}`,
      DAILY_SUBMIT_RATE_LIMIT.max,
      DAILY_SUBMIT_RATE_LIMIT.windowSeconds,
    )
    if (!allowed) return errorResponse('Çok fazla gönderim, lütfen sonra tekrar deneyin', 429)

    const body = await parseBody(request)
    if (!body) return errorResponse('Geçersiz istek gövdesi')
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.message)
    const { submissionId, answers } = parsed.data

    // 1) IDEMPOTENCY — bu submissionId daha önce işlendiyse aynı sonucu dön.
    const existing = await prisma.dailySubmission.findUnique({
      where: { submissionId },
      select: { correctCount: true, pointsAwarded: true, resultsJson: true },
    })
    if (existing) {
      return jsonResponse(toResponse(existing))
    }

    // Aynı soru birden çok gönderildiyse ilkini al (deterministik).
    const answerByQuestion = new Map<string, string>()
    for (const a of answers) {
      if (!answerByQuestion.has(a.questionId)) answerByQuestion.set(a.questionId, a.optionId)
    }
    const submittedIds = [...answerByQuestion.keys()]

    // 2) Havuz durumu + doğru cevaplar (paralel — perf kuralı). isCorrect yalnız sunucuda.
    const [reviews, correctOptions] = await Promise.all([
      prisma.dailyReview.findMany({
        where: { userId: dbUser.id, questionId: { in: submittedIds } },
        select: { questionId: true, box: true },
      }),
      prisma.questionOption.findMany({
        where: { questionId: { in: submittedIds }, isCorrect: true },
        select: { questionId: true, id: true },
      }),
    ])

    const boxByQuestion = new Map(reviews.map((r) => [r.questionId, r.box]))
    const correctByQuestion = new Map<string, Set<string>>()
    for (const o of correctOptions) {
      const set = correctByQuestion.get(o.questionId) ?? new Set<string>()
      set.add(o.id)
      correctByQuestion.set(o.questionId, set)
    }

    // Yalnız personelin havuzunda OLAN soruları işle (anti-abuse: rastgele soru kabul edilmez).
    const now = new Date()
    const results: ReviewResult[] = []
    let correctCount = 0

    try {
      const persisted = await prisma.$transaction(async (tx) => {
        for (const questionId of submittedIds) {
          const oldBox = boxByQuestion.get(questionId)
          if (oldBox === undefined) continue // havuzda yok → atla

          const optionId = answerByQuestion.get(questionId)!
          const isCorrect = correctByQuestion.get(questionId)?.has(optionId) ?? false
          const newBox = nextBox(oldBox, isCorrect)
          const nextReviewAt = dueDateForBox(newBox, now)

          await tx.dailyReview.update({
            where: { userId_questionId: { userId: dbUser.id, questionId } },
            data: { box: newBox, lastResult: isCorrect, lastReviewedAt: now, nextReviewAt },
          })

          if (isCorrect) correctCount++
          results.push({
            questionId,
            correct: isCorrect,
            newBox,
            nextReviewAt: istanbulDateString(nextReviewAt),
          })
        }

        const pointsAwarded = correctCount * POINTS.dailyReviewCorrect
        await tx.dailySubmission.create({
          data: {
            submissionId,
            userId: dbUser.id,
            organizationId,
            correctCount,
            pointsAwarded,
            resultsJson: results as unknown as Prisma.InputJsonValue,
          },
        })
        // Faz 2: kanonik puan defteri (toplam=SUM). dedupKey idempotency (DailySubmission ile aynı kapı).
        await tx.pointLedger.create({
          data: {
            userId: dbUser.id,
            organizationId,
            eventType: POINT_EVENT.dailyReview,
            refId: submissionId,
            points: pointsAwarded,
            dedupKey: `${POINT_EVENT.dailyReview}:${submissionId}`,
          },
        })
        // Faz 2: günlük seri (server-clock) — submit = aktiflik tetikleyicisi.
        await touchStreak(tx, dbUser.id, organizationId)
        return { correctCount, pointsAwarded, results }
      })

      // Faz 2: rozet değerlendirmesi (transaction dışı; hata isteği bozmaz).
      try {
        await evaluateBadges(dbUser.id, organizationId)
      } catch (badgeErr) {
        logger.warn('daily-submit', 'Rozet değerlendirmesi başarısız', {
          userId: dbUser.id,
          error: badgeErr instanceof Error ? badgeErr.message : String(badgeErr),
        })
      }

      return jsonResponse(persisted satisfies SubmitResponse)
    } catch (err) {
      // Eşzamanlı aynı submissionId → unique ihlali (P2002). Kaydedilmiş snapshot'ı dön
      // (çift-kredi imkansız, idempotent replay).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const snapshot = await prisma.dailySubmission.findUnique({
          where: { submissionId },
          select: { correctCount: true, pointsAwarded: true, resultsJson: true },
        })
        if (snapshot) return jsonResponse(toResponse(snapshot))
      }
      logger.error('daily-submit', 'Günün soruları gönderimi başarısız', {
        userId: dbUser.id,
        submissionId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse('Gönderim işlenemedi, lütfen tekrar deneyin', 500)
    }
  },
  { requireOrganization: true },
)

/** Kaydedilmiş snapshot'ı API yanıt şekline çevirir (replay). */
function toResponse(s: {
  correctCount: number
  pointsAwarded: number
  resultsJson: unknown
}): SubmitResponse {
  return {
    correctCount: s.correctCount,
    pointsAwarded: s.pointsAwarded,
    results: (s.resultsJson as ReviewResult[]) ?? [],
  }
}
