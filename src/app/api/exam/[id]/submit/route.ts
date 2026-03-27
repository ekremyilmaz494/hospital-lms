import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { submitExamSchema } from '@/lib/validations'
import { checkRateLimit, clearExamTimer } from '@/lib/redis'


/** Submit pre-exam or post-exam answers */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // Rate limit: kullanıcı başına dakikada 10 submit
  const allowed = await checkRateLimit(`exam-submit:${dbUser!.id}`, 10, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = submitExamSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[Submit Validation Error]', JSON.stringify(parsed.error.issues), 'Body keys:', Object.keys(body as object))
    return errorResponse(parsed.error.message)
  }

  // Try as attemptId first, then as assignmentId
  let attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id },
    include: { training: true, assignment: true },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { assignmentId: attemptId, userId: dbUser!.id, status: { not: 'completed' } },
      include: { training: true, assignment: true },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Aktif sınav denemesi bulunamadı. Sınavı yeniden başlatın.', 404)
  if (attempt.status === 'completed') return errorResponse('Bu deneme zaten tamamlanmış', 400)

  // Server-side timer check — reject submissions more than 5 minutes past exam duration
  const phaseStartedAt = attempt.status === 'pre_exam' ? attempt.preExamStartedAt : attempt.postExamStartedAt
  if (phaseStartedAt && attempt.training.examDurationMinutes) {
    const allowedMs = (attempt.training.examDurationMinutes + 5) * 60 * 1000 // +5 min grace
    const elapsed = Date.now() - new Date(phaseStartedAt).getTime()
    if (elapsed > allowedMs) {
      console.warn(`[Submit] Late submission rejected: attempt=${attempt.id}, elapsed=${Math.round(elapsed / 60000)}min`)
      return errorResponse('Sınav süresi çoktan dolmuş. Bu gönderim kabul edilemez.', 403)
    }
  }

  const phase = attempt.status === 'pre_exam' ? 'pre' : 'post'

  // Get correct answers
  const questions = await prisma.question.findMany({
    where: { trainingId: attempt.trainingId },
    include: { options: true },
  })

  const questionMap = new Map(questions.map(q => [q.id, q]))

  // Calculate score — cevaplanmamış sorular yanlış sayılır (submit engellenmez)
  let totalPoints = 0
  let earnedPoints = 0

  const validAnswers = parsed.data.answers
    .filter(a => questionMap.has(a.questionId))
    .map(a => {
      const question = questionMap.get(a.questionId)!
      totalPoints += question.points
      const correctOption = question.options.find(o => o.isCorrect)
      const isCorrect = correctOption?.id === a.selectedOptionId
      if (isCorrect) earnedPoints += question.points
      return {
        attemptId: attempt.id,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect,
        examPhase: phase,
      }
    })

  // Cevaplanmamış soruları da toplam puana ekle (yanlış sayılır)
  const answeredIds = new Set(parsed.data.answers.map(a => a.questionId))
  for (const q of questions) {
    if (!answeredIds.has(q.id)) {
      totalPoints += q.points
    }
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

  // Idempotency: eger bu faz icin skor zaten hesaplanmissa tekrar isleme
  const alreadyScored = phase === 'pre' ? attempt.preExamScore !== null : attempt.postExamScore !== null
  if (alreadyScored) {
    if (phase === 'pre') {
      return jsonResponse({ phase: 'pre', score: Number(attempt.preExamScore), nextStep: 'videos' })
    }
    return jsonResponse({ phase: 'post', score: Number(attempt.postExamScore), isPassed: attempt.isPassed, passingScore: attempt.training.passingScore })
  }

  // Onceden auto-save ile kaydedilmis cevaplari sil ve yenilerini yaz
  await prisma.examAnswer.deleteMany({
    where: { attemptId: attempt.id, examPhase: phase }
  })

  // Save final answers with isCorrect
  if (validAnswers.length > 0) {
    await prisma.examAnswer.createMany({ data: validAnswers })
  }

  // Update attempt based on phase
  if (phase === 'pre') {
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        preExamScore: score,
        preExamCompletedAt: new Date(),
        status: 'watching_videos',
      },
    })
    await clearExamTimer(attempt.id)
    return jsonResponse({ phase: 'pre', score, nextStep: 'videos' })
  }

  // Post-exam
  const isPassed = score >= attempt.training.passingScore

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      postExamScore: score,
      postExamCompletedAt: new Date(),
      isPassed,
      status: 'completed',
    },
  })

  // Timer temizle
  await clearExamTimer(attempt.id)

  // Update assignment status
  const newStatus = isPassed ? 'passed' : (
    attempt.assignment.currentAttempt >= attempt.assignment.maxAttempts ? 'failed' : 'in_progress'
  )

  await prisma.trainingAssignment.update({
    where: { id: attempt.assignmentId },
    data: {
      status: newStatus,
      ...(isPassed && { completedAt: new Date() }),
    },
  })

  // Create notification
  await prisma.notification.create({
    data: {
      userId: dbUser!.id,
      organizationId: attempt.training.organizationId,
      title: isPassed ? 'Sınavı Geçtiniz!' : 'Sınav Sonucu',
      message: isPassed
        ? `"${attempt.training.title}" eğitimini ${score} puanla başarıyla tamamladınız.`
        : `"${attempt.training.title}" sınavından ${score} puan aldınız. Geçme notu: ${attempt.training.passingScore}.`,
      type: isPassed ? 'exam_passed' : 'exam_failed',
      relatedTrainingId: attempt.trainingId,
    },
  })

  // Auto-generate certificate
  if (isPassed) {
    const code = `CERT-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`
    await prisma.certificate.create({
      data: {
        userId: dbUser!.id,
        trainingId: attempt.trainingId,
        attemptId: attempt.id,
        certificateCode: code,
      },
    })
  }

  return jsonResponse({ phase: 'post', score, isPassed, passingScore: attempt.training.passingScore })
}
