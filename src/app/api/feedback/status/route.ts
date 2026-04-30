import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { isAttemptFeedbackTriggered } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/feedback/status?attemptId=xxx
 * Staff'ın bu attempt için geri bildirim gönderip göndermediğini kontrol eder.
 * UI akışı: staff eğitimi bitirince bu endpoint ile submit gerekip gerekmediğini anlar.
 */
export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  const url = new URL(request.url)
  const attemptId = url.searchParams.get('attemptId')
  if (!attemptId) return errorResponse('attemptId gerekli', 400)

  try {
    // Org isolation + trigger hesabı için gereken alanlar
    const [attempt, activeForm] = await Promise.all([
      prisma.examAttempt.findFirst({
        where: {
          id: attemptId,
          userId: dbUser.id,
          training: { organizationId },
        },
        select: {
          id: true,
          status: true,
          isPassed: true,
          attemptNumber: true,
          trainingId: true,
          training: { select: { title: true, feedbackMandatory: true } },
          assignment: { select: { originalMaxAttempts: true } },
          feedbackResponse: { select: { id: true, submittedAt: true } },
        },
      }),
      prisma.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true },
        select: { id: true },
      }),
    ])

    if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

    // Kullanıcının bu eğitim için DAHA ÖNCE feedback verip vermediği —
    // attempt.userId üzerinden bağlıyoruz: anonim gönderimler (userId=null) de
    // yakalanır çünkü her feedback bir attempt'e bağlı, attempt'in userId'si kesin.
    const priorFeedback = await prisma.trainingFeedbackResponse.findFirst({
      where: {
        trainingId: attempt.trainingId,
        attempt: { userId: dbUser.id },
      },
      select: { id: true, submittedAt: true },
    })

    // Trigger koşulu — paylaşılan helper:
    //  1. Aktif form var
    //  2. Kullanıcı daha önce bu eğitim için feedback vermemiş
    //  3. Attempt completed + cycle içinde + (passed || final original)
    const feedbackRequired =
      !!activeForm &&
      !priorFeedback &&
      isAttemptFeedbackTriggered(attempt, attempt.assignment.originalMaxAttempts)

    return jsonResponse({
      attemptStatus: attempt.status,
      isPassed: attempt.isPassed,
      hasSubmittedFeedback: !!priorFeedback,
      submittedAt: priorFeedback?.submittedAt ?? attempt.feedbackResponse?.submittedAt ?? null,
      feedbackRequired,
      feedbackMandatory: attempt.training.feedbackMandatory,
      trainingId: attempt.trainingId,
      trainingTitle: attempt.training.title,
      formId: activeForm?.id ?? null,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (err) {
    logger.error('FeedbackStatus GET', 'Durum alınamadı', { err, userId: dbUser.id, attemptId })
    return errorResponse('Durum kontrol edilirken hata oluştu', 500)
  }
}, { requireOrganization: true })
