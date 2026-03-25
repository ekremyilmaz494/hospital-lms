import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { submitExamSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/redis'

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
  if (!parsed.success) return errorResponse(parsed.error.message)

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id },
    include: { training: true, assignment: true },
  })

  if (!attempt) return errorResponse('Attempt not found', 404)

  const phase = attempt.status === 'pre_exam' ? 'pre' : 'post'

  // Get correct answers
  const questions = await prisma.question.findMany({
    where: { trainingId: attempt.trainingId },
    include: { options: true },
  })

  const questionMap = new Map(questions.map(q => [q.id, q]))

  // Validate all questions are answered
  const answeredIds = new Set(parsed.data.answers.map(a => a.questionId))
  const unanswered = questions.filter(q => !answeredIds.has(q.id))
  if (unanswered.length > 0) {
    return errorResponse(`${unanswered.length} soru cevaplanmamış. Tüm soruları cevaplayınız.`)
  }

  // Validate all questionIds are real
  const invalidIds = parsed.data.answers.filter(a => !questionMap.has(a.questionId))
  if (invalidIds.length > 0) {
    return errorResponse('Geçersiz soru ID\'si gönderildi.')
  }

  // Calculate score
  let totalPoints = 0
  let earnedPoints = 0

  const answers = parsed.data.answers.map(a => {
    const question = questionMap.get(a.questionId)
    if (!question) return null

    totalPoints += question.points
    const correctOption = question.options.find(o => o.isCorrect)
    const isCorrect = correctOption?.id === a.selectedOptionId

    if (isCorrect) earnedPoints += question.points

    return {
      attemptId,
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      isCorrect,
      examPhase: phase,
    }
  }).filter(Boolean) as {
    attemptId: string
    questionId: string
    selectedOptionId: string
    isCorrect: boolean
    examPhase: string
  }[]

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

  // Save answers
  await prisma.examAnswer.createMany({ data: answers })

  // Update attempt based on phase
  if (phase === 'pre') {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        preExamScore: score,
        preExamCompletedAt: new Date(),
        status: 'watching_videos',
      },
    })

    return jsonResponse({ phase: 'pre', score, nextStep: 'videos' })
  }

  // Post-exam
  const isPassed = score >= attempt.training.passingScore

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      postExamScore: score,
      postExamCompletedAt: new Date(),
      isPassed,
      status: 'completed',
    },
  })

  // Update assignment status
  const newStatus = isPassed ? 'passed' : (
    attempt.assignment.currentAttempt >= attempt.assignment.maxAttempts ? 'failed' : 'assigned'
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

  return jsonResponse({ phase: 'post', score, isPassed, passingScore: attempt.training.passingScore })
}
