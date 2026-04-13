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
    // Org isolation: attempt kullanıcıya ve org'a ait mi?
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        userId: dbUser.id,
        training: { organizationId: dbUser.organizationId },
      },
      select: {
        id: true,
        status: true,
        isPassed: true,
        feedbackResponse: { select: { id: true, submittedAt: true } },
      },
    })

    if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

    const activeForm = await prisma.trainingFeedbackForm.findFirst({
      where: { organizationId: dbUser.organizationId, isActive: true },
      select: { id: true },
    })

    return jsonResponse({
      attemptStatus: attempt.status,
      isPassed: attempt.isPassed,
      hasSubmittedFeedback: !!attempt.feedbackResponse,
      submittedAt: attempt.feedbackResponse?.submittedAt ?? null,
      feedbackRequired: attempt.status === 'completed' && !!activeForm && !attempt.feedbackResponse,
      formId: activeForm?.id ?? null,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (err) {
    logger.error('FeedbackStatus GET', 'Durum alınamadı', { err, userId: dbUser.id, attemptId })
    return errorResponse('Durum kontrol edilirken hata oluştu', 500)
  }
}
