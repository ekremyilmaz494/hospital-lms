import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { submitExamSchema } from '@/lib/validations'
import { checkRateLimit, clearExamTimer } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { logger } from '@/lib/logger'


/** Submit pre-exam or post-exam answers */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // User bazlı rate limit: 20 submit / 1 saat
  const allowed = await checkRateLimit(`exam-submit:${dbUser!.id}`, 20, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla gönderim. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = submitExamSchema.safeParse(body)
  if (!parsed.success) {
    logger.error('Exam Submit', 'Validasyon hatası', { issues: parsed.error.issues, bodyKeys: Object.keys(body as object) })
    return errorResponse(parsed.error.message)
  }

  // B7.3/G7.3 — Explicit organizationId cross-check: training.organizationId === dbUser.organizationId
  let attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id, training: { organizationId: dbUser!.organizationId! } },
    include: { training: true, assignment: true },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: {
        assignmentId: attemptId,
        userId: dbUser!.id,
        status: { not: 'completed' },
        training: { organizationId: dbUser!.organizationId! },
      },
      include: { training: true, assignment: true },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Aktif sınav denemesi bulunamadı. Sınavı yeniden başlatın.', 404)
  if (attempt.status === 'completed') return errorResponse('Bu deneme zaten tamamlanmış', 400)

  // Phase transition validation — ensure attempt status matches the submitted phase
  const submittedPhase = parsed.data.phase ?? (attempt.status === 'pre_exam' ? 'pre' : 'post')
  if (submittedPhase === 'pre' && attempt.status !== 'pre_exam') {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }
  if (submittedPhase === 'post' && attempt.status !== 'post_exam') {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }

  // B7.1/G7.1 — phaseStartedAt null ise sınav başlatılmamış demek; gönderimi reddet
  const phaseStartedAt = attempt.status === 'pre_exam' ? attempt.preExamStartedAt : attempt.postExamStartedAt
  if (!phaseStartedAt) {
    logger.warn('Exam Submit', 'phaseStartedAt null — sınav başlatılmamış, gönderim reddedildi', { attemptId: attempt.id })
    return errorResponse('Sınav henüz başlatılmamış. Lütfen sınavı yeniden başlatın.', 400)
  }

  // Server-side timer check — reject submissions more than 5 minutes past exam duration
  if (attempt.training.examDurationMinutes) {
    const allowedMs = (attempt.training.examDurationMinutes + 5) * 60 * 1000 // +5 min grace
    const elapsed = Date.now() - new Date(phaseStartedAt).getTime()
    if (elapsed > allowedMs) {
      logger.warn('Exam Submit', 'Geç gönderim reddedildi', { attemptId: attempt.id, elapsedMin: Math.round(elapsed / 60000) })
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

  // G7.5 — Post-exam: per-question results for the result screen
  const questionResults = phase === 'post'
    ? questions
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(q => {
          const answer = parsed.data.answers.find(a => a.questionId === q.id)
          const correctOption = q.options.find(o => o.isCorrect)
          const selectedOption = answer ? q.options.find(o => o.id === answer.selectedOptionId) : null
          return {
            questionText: q.questionText,
            selectedOptionText: selectedOption?.optionText ?? null,
            correctOptionText: correctOption?.optionText ?? null,
            isCorrect: !!(selectedOption && selectedOption.id === correctOption?.id),
          }
        })
    : undefined

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

  // Update attempt based on phase — atomic status guard prevents double-submit race condition
  if (phase === 'pre') {
    const updated = await prisma.examAttempt.updateMany({
      where: { id: attempt.id, status: 'pre_exam' },
      data: { preExamScore: score, preExamCompletedAt: new Date(), status: 'watching_videos' },
    })
    if (updated.count === 0) {
      // Concurrent request already processed this submission
      return jsonResponse({ phase: 'pre', score: Number(attempt.preExamScore ?? score), nextStep: 'videos' })
    }
    await clearExamTimer(attempt.id)
    return jsonResponse({ phase: 'pre', score, nextStep: 'videos' })
  }

  // Post-exam
  const isPassed = score >= attempt.training.passingScore

  const updated = await prisma.examAttempt.updateMany({
    where: { id: attempt.id, status: 'post_exam' },
    data: { postExamScore: score, postExamCompletedAt: new Date(), isPassed, status: 'completed' },
  })
  if (updated.count === 0) {
    // Concurrent request already completed this attempt
    return jsonResponse({ phase: 'post', score: Number(attempt.postExamScore ?? score), isPassed: attempt.isPassed ?? isPassed, passingScore: attempt.training.passingScore })
  }

  // Timer temizle
  await clearExamTimer(attempt.id)

  // Update assignment status
  // assignment.maxAttempts admin "Yeni Hak Ver" ile override edilmiş olabilir
  const effectiveMaxAttempts = attempt.assignment.maxAttempts ?? attempt.training.maxAttempts
  const newStatus = isPassed ? 'passed' : (
    attempt.attemptNumber >= effectiveMaxAttempts ? 'failed' : 'in_progress'
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
    // B6.1/G6.1 — Kriptografik olarak güvenli sertifika kodu (önceki: Date.now()+Math.random, ~16M kombinasyon)
    const code = `CERT-${randomBytes(16).toString('hex').toUpperCase()}`
    await prisma.certificate.create({
      data: {
        userId: dbUser!.id,
        trainingId: attempt.trainingId,
        attemptId: attempt.id,
        certificateCode: code,
      },
    })
  }

  // Eğitim tamamlandığında otomatik SMG aktivitesi (fire-and-forget)
  if (isPassed) {
    prisma.smgActivity.create({
      data: {
        userId: dbUser!.id,
        organizationId: attempt.training.organizationId,
        activityType: 'COURSE_COMPLETION',
        title: attempt.training.title,
        provider: 'Devakent LMS',
        completionDate: new Date(),
        smgPoints: 10,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
      },
    }).catch(err => logger.error('SMG', 'Otomatik SMG aktivitesi oluşturulamadı', { err, attemptId: attempt.id }))
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: attempt.training.organizationId,
    action: isPassed ? 'exam.passed' : 'exam.failed',
    entityType: 'exam_attempt',
    entityId: attempt.id,
    newData: { score, isPassed, trainingId: attempt.trainingId },
  })

  try { await invalidateDashboardCache(attempt.training.organizationId) } catch {}

  return jsonResponse({ phase: 'post', score, isPassed, passingScore: attempt.training.passingScore, results: questionResults })
}
