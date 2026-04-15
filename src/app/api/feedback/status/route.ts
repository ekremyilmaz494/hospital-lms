import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/feedback/status?attemptId=xxx
 * Staff'ın bu attempt için geri bildirim gönderip göndermediğini kontrol eder.
 * UI akışı: staff eğitimi bitirince bu endpoint ile submit gerekip gerekmediğini anlar.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

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
          training: { organizationId: dbUser.organizationId },
        },
        select: {
          id: true,
          status: true,
          isPassed: true,
          attemptNumber: true,
          trainingId: true,
          assignment: { select: { originalMaxAttempts: true } },
          feedbackResponse: { select: { id: true, submittedAt: true } },
        },
      }),
      prisma.trainingFeedbackForm.findFirst({
        where: { organizationId: dbUser.organizationId, isActive: true },
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

    // Trigger koşulu:
    //  1. Aktif form var
    //  2. Kullanıcı daha önce bu eğitim için feedback vermemiş
    //  3. Sınav tamamlanmış (status === 'completed')
    //  4. Attempt orijinal atama cycle'ı içinde (attemptNumber <= originalMaxAttempts)
    //  5. Ya başarılı ya da orijinal cycle'ın son denemesi
    const originalMax = attempt.assignment.originalMaxAttempts
    const withinOriginalCycle = attempt.attemptNumber <= originalMax
    const isFinalOriginalAttempt = attempt.attemptNumber === originalMax
    const triggerCondition = attempt.isPassed || isFinalOriginalAttempt

    const feedbackRequired =
      !!activeForm &&
      !priorFeedback &&
      attempt.status === 'completed' &&
      withinOriginalCycle &&
      triggerCondition

    return jsonResponse({
      attemptStatus: attempt.status,
      isPassed: attempt.isPassed,
      hasSubmittedFeedback: !!priorFeedback,
      submittedAt: priorFeedback?.submittedAt ?? attempt.feedbackResponse?.submittedAt ?? null,
      feedbackRequired,
      formId: activeForm?.id ?? null,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (err) {
    logger.error('FeedbackStatus GET', 'Durum alınamadı', { err, userId: dbUser.id, attemptId })
    return errorResponse('Durum kontrol edilirken hata oluştu', 500)
  }
}
