import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { withStaffRoute } from '@/lib/api-handler'

/** Auto-save a single exam answer (called on each answer selection) */
export const POST = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id } = params

  const allowed = await checkRateLimit(`save-answer:${dbUser.id}`, 60, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody<{ questionId: string; selectedOptionId: string; examPhase: string }>(request)
  if (!body?.questionId || !body?.selectedOptionId || !body?.examPhase) {
    return errorResponse('questionId, selectedOptionId ve examPhase zorunlu', 400)
  }

  if (!['pre', 'post'].includes(body.examPhase)) {
    return errorResponse('examPhase pre veya post olmali', 400)
  }

  // Find active attempt
  const requiredStatus = body.examPhase === 'pre' ? 'pre_exam' : 'post_exam'
  let attempt = await prisma.examAttempt.findFirst({
    where: { assignmentId: id, userId: dbUser.id, status: requiredStatus },
    include: { training: { select: { organizationId: true } } },
    orderBy: { attemptNumber: 'desc' },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { trainingId: id, userId: dbUser.id, status: requiredStatus },
      include: { training: { select: { organizationId: true } } },
      orderBy: { attemptNumber: 'desc' },
    })
  }
  if (!attempt) return errorResponse('Aktif sınav denemesi bulunamadı', 404)

  // Verify org isolation
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  // Upsert answer (attemptId + questionId + examPhase)
  const existing = await prisma.examAnswer.findFirst({
    where: { attemptId: attempt.id, questionId: body.questionId, examPhase: body.examPhase },
  })

  if (existing) {
    // K2: Post-exam answer lock — 30 sn grace süresi, sonra cevap kilitli.
    // "Fikir değiştirme" penceresi açık; DevTools ile geriye dönüp eski soruları
    // sonradan değiştirme girişimleri reddedilir.
    if (body.examPhase === 'post') {
      const ageMs = Date.now() - new Date(existing.answeredAt).getTime()
      const GRACE_MS = 30_000
      if (ageMs > GRACE_MS) {
        return errorResponse('Bu sorunun cevabı kilitlendi, değiştirilemez', 423)
      }
    }
    await prisma.examAnswer.update({
      where: { id: existing.id },
      data: { selectedOptionId: body.selectedOptionId, answeredAt: new Date() },
    })
  } else {
    await prisma.examAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: body.questionId,
        selectedOptionId: body.selectedOptionId,
        examPhase: body.examPhase,
        isCorrect: null, // Final submit'te hesaplanacak
      },
    })
  }

  return jsonResponse({ saved: true })
}, { requireOrganization: true })
