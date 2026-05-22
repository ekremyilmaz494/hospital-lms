import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { submitExamSchema } from '@/lib/validations'
import { checkRateLimit, clearExamTimer } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'
import { isAttemptFeedbackTriggered } from '@/lib/feedback-helpers'
import { issueCertificateForAttempt } from '@/lib/certificate-helpers'
import { getEffectiveExamQuestions, advancePastVideosIfNoneRequired } from '@/lib/exam-helpers'
import {
  attemptNextStatus,
  assignmentNextStatus,
  isAttemptInPhase,
  attemptStatusToExamPhase,
  type AttemptStatus,
  type AssignmentStatus,
} from '@/lib/exam-state-machine'


/** Submit pre-exam or post-exam answers */
export const POST = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id: attemptId } = params

  // User bazlı rate limit: 20 submit / 1 saat
  const allowed = await checkRateLimit(`exam-submit:${dbUser.id}`, 20, 3600)
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
  let attempt = await prisma.examAttempt.findFirst({ // perf-check-disable-line
    where: { id: attemptId, userId: dbUser.id, training: { organizationId: organizationId } },
    include: { training: { include: { organization: { select: { name: true } } } }, assignment: true },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: {
        assignmentId: attemptId,
        userId: dbUser.id,
        status: { not: 'completed' },
        training: { organizationId: organizationId },
      },
      include: { training: { include: { organization: { select: { name: true } } } }, assignment: true },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Aktif sınav denemesi bulunamadı. Sınavı yeniden başlatın.', 404)

  // ── Idempotent replay ────────────────────────────────────────────────────
  // Çift submit (çift tıklama, retry, ağ tekrarı) 400 yerine KAYITLI sonucu
  // dönmeli — aksi halde sonuç ekranı sahte "zaten tamamlanmış" hatası gösterir.
  // Eski `status==='completed' → 400`, alttaki `alreadyScored` idempotency
  // bloğunu faz guard'ları yüzünden tamamen ulaşılamaz (ölü kod) bırakıyordu.
  if (attempt.status === 'completed') {
    const eff = attempt.assignment.maxAttempts ?? attempt.training.maxAttempts
    return jsonResponse({
      phase: 'post',
      score: attempt.postExamScore !== null ? Number(attempt.postExamScore) : 0,
      isPassed: attempt.isPassed ?? false,
      passingScore: attempt.training.passingScore,
      attemptsRemaining: attempt.isPassed ? 0 : Math.max(0, eff - attempt.attemptNumber),
    })
  }
  // Pre-exam zaten gönderilmiş (status pre_exam'dan ilerlemiş) ve client yine
  // 'pre' submit ediyorsa kayıtlı pre skorunu idempotent dön.
  if (
    parsed.data.phase === 'pre' &&
    attempt.status !== 'pre_exam' &&
    attempt.preExamScore !== null
  ) {
    return jsonResponse({ phase: 'pre', score: Number(attempt.preExamScore), nextStep: 'videos' })
  }

  // Phase transition validation — ensure attempt status matches the submitted phase
  const attemptStatus = attempt.status as AttemptStatus
  const phase = attemptStatusToExamPhase(attemptStatus)
  if (!phase) {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }
  const submittedPhase = parsed.data.phase ?? phase
  if (submittedPhase === 'pre' && !isAttemptInPhase(attemptStatus, ['pre_exam'])) {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }
  if (submittedPhase === 'post' && !isAttemptInPhase(attemptStatus, ['post_exam'])) {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }

  // B7.1/G7.1 — phaseStartedAt null ise sınav başlatılmamış demek; gönderimi reddet
  const phaseStartedAt = phase === 'pre' ? attempt.preExamStartedAt : attempt.postExamStartedAt
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

  // Get correct answers
  // KRITIK: questions/route.ts ile birebir aynı sırada al — getEffectiveExamQuestions
  // Fisher-Yates shuffle kullanır ve giriş dizisi sırasına bağımlıdır. Postgres'in
  // doğal satır sırası deterministik olmadığından `orderBy: { sortOrder: 'asc' }`
  // şart; aksi halde aynı seed + farklı başlangıç sırası = farklı subset.
  const allQuestions = await prisma.question.findMany({
    where: { trainingId: attempt.trainingId },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  // KRITIK: questions/route.ts ile aynı subset/sırayı uygula. randomQuestionCount
  // aktifken (examOnly) kullanıcıya gösterilen 5 sorudan başkasını puanlamaya
  // dahil edersek, görülmemiş sorular sessizce "yanlış" sayılır ve sınav haksız
  // yere kaldırılır. Deterministik seed (attempt.id + phase) iki tarafı eşler.
  const questions = getEffectiveExamQuestions(
    allQuestions,
    attempt.training,
    attempt.id,
    phase,
  )

  const questionMap = new Map(questions.map(q => [q.id, q]))

  // K2: Post-exam'da body.answers'a güvenme — DevTools ile manipüle edilebilir.
  // Onun yerine save-answer üzerinden persist edilmiş examAnswer kayıtlarını
  // otorite kabul et. save-answer, 30 sn'lik grace sonrası kilitleme uygular,
  // yani geriye dönüp soru değiştirme girişimi server'da reddedilmiş olur.
  const sourceAnswers = phase === 'post'
    ? (await prisma.examAnswer.findMany({
        where: { attemptId: attempt.id, examPhase: 'post' },
        select: { questionId: true, selectedOptionId: true },
      }))
    : parsed.data.answers

  // Calculate score — cevaplanmamış sorular yanlış sayılır (submit engellenmez)
  let totalPoints = 0
  let earnedPoints = 0

  const validAnswers = sourceAnswers
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

  // E-1 gözlemlenebilirlik: sınav sırasında soru silindi/değiştirildiyse personelin
  // kayıtlı cevabı questionMap'te bulunamaz ve sessizce düşer. Skorlama davranışı
  // (görülmemiş soru = yanlış) kasıtlı korunur — ama admin'in eğitimi sınav ortasında
  // düzenlediğini fark edebilmesi için iz bırak.
  const droppedAnswers = sourceAnswers.filter(a => !questionMap.has(a.questionId))
  if (droppedAnswers.length > 0) {
    logger.warn('Exam Submit', 'Answers dropped — questions changed mid-exam', {
      attemptId: attempt.id,
      phase,
      droppedQuestionIds: droppedAnswers.map(a => a.questionId),
    })
  }

  // Cevaplanmamış soruları da toplam puana ekle (yanlış sayılır)
  const answeredIds = new Set(sourceAnswers.map(a => a.questionId))
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
          const answer = sourceAnswers.find(a => a.questionId === q.id)
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

  // ── Skor yazımı — TEK transaction ────────────────────────────────────────
  // Eskiden examAnswer.deleteMany / createMany / examAttempt.updateMany ayrı
  // await'lerdi: deleteMany ile createMany arasında bir çökme personelin
  // cevaplarını kalıcı siliyordu. Artık hepsi tek transaction'da.
  // CAS (status-filtreli updateMany) transaction'ın İLK adımı — yarışı
  // kaybeden eşzamanlı istek hiçbir yazma yapmadan (raced=true) çıkar.
  if (phase === 'pre') {
    const preTransition = attemptNextStatus(attemptStatus, { type: 'PRE_EXAM_SUBMITTED' })
    if (!preTransition.ok) {
      return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
    }
    const raced = await prisma.$transaction(async (tx) => {
      const updated = await tx.examAttempt.updateMany({
        where: { id: attempt.id, status: 'pre_exam' satisfies AttemptStatus },
        data: { preExamScore: score, preExamCompletedAt: new Date(), status: preTransition.next },
      })
      if (updated.count === 0) return true // yarış kaybedildi — yazma yapma
      await tx.examAnswer.deleteMany({ where: { attemptId: attempt.id, examPhase: phase } })
      if (validAnswers.length > 0) await tx.examAnswer.createMany({ data: validAnswers })
      return false
    })
    if (raced) {
      // Eşzamanlı istek zaten işledi — kayıtlı skoru idempotent dön.
      return jsonResponse({ phase: 'pre', score: Number(attempt.preExamScore ?? score), nextStep: 'videos' })
    }
    await clearExamTimer(attempt.id)
    // Videosuz/PDF-only eğitim için akış kilidi kırma: eğitimde post_exam'i
    // tetikleyecek içerik yoksa kullanıcıyı doğrudan son sınava yönlendir.
    const advance = await advancePastVideosIfNoneRequired(attempt.id, attempt.trainingId)
    return jsonResponse({
      phase: 'pre',
      score,
      nextStep: advance.advanced ? 'post-exam' : 'videos',
    })
  }

  // Post-exam
  const isPassed = score >= attempt.training.passingScore

  const postTransition = attemptNextStatus(attemptStatus, { type: 'POST_EXAM_SUBMITTED' })
  if (!postTransition.ok) {
    return errorResponse('Bu aşamada sınav gönderimi yapılamaz', 400)
  }

  const effectiveMaxAttempts = attempt.assignment.maxAttempts ?? attempt.training.maxAttempts
  const assignmentEvent = isPassed
    ? ({ type: 'POST_EXAM_PASSED' } as const)
    : ({ type: 'POST_EXAM_FAILED', attemptsRemaining: Math.max(0, effectiveMaxAttempts - attempt.attemptNumber) } as const)
  const assignmentTransition = assignmentNextStatus(
    attempt.assignment.status as AssignmentStatus,
    assignmentEvent,
  )
  if (!assignmentTransition.ok) {
    return errorResponse('Atama durumu güncellenemedi: geçersiz durum geçişi', 400)
  }

  // Skor + cevaplar + assignment durumu TEK transaction'da: biri başarısız
  // olursa hepsi geri alınır — attempt 'completed' ama assignment durumu
  // eski kalmaz. CAS ilk adım: yarışı kaybeden istek yazma yapmaz.
  const raced = await prisma.$transaction(async (tx) => {
    const updated = await tx.examAttempt.updateMany({
      where: { id: attempt.id, status: 'post_exam' satisfies AttemptStatus },
      data: { postExamScore: score, postExamCompletedAt: new Date(), isPassed, status: postTransition.next },
    })
    if (updated.count === 0) return true
    await tx.examAnswer.deleteMany({ where: { attemptId: attempt.id, examPhase: phase } })
    if (validAnswers.length > 0) await tx.examAnswer.createMany({ data: validAnswers })
    await tx.trainingAssignment.update({
      where: { id: attempt.assignmentId },
      data: {
        status: assignmentTransition.next,
        ...(isPassed && { completedAt: new Date() }),
      },
    })
    return false
  })
  if (raced) {
    // Eşzamanlı istek zaten tamamladı — kayıtlı sonucu idempotent dön.
    return jsonResponse({ phase: 'post', score: Number(attempt.postExamScore ?? score), isPassed: attempt.isPassed ?? isPassed, passingScore: attempt.training.passingScore })
  }

  // Redis timer — transaction dışında (Prisma transaction'a giremez).
  await clearExamTimer(attempt.id)

  const tabSwitchCount = parsed.data.tabSwitchCount ?? 0
  const suspicious = tabSwitchCount >= 3

  // Non-critical: bildirim, sertifika, SMG, audit — response'u bloklamaz
  void Promise.allSettled([
    prisma.notification.create({
      data: {
        userId: dbUser.id,
        organizationId: attempt.training.organizationId,
        title: isPassed ? 'Sınavı Geçtiniz!' : 'Sınav Sonucu',
        message: isPassed
          ? `"${attempt.training.title}" eğitimini ${score} puanla başarıyla tamamladınız.`
          : `"${attempt.training.title}" sınavından ${score} puan aldınız. Geçme notu: ${attempt.training.passingScore}.`,
        type: isPassed ? 'exam_passed' : 'exam_failed',
        relatedTrainingId: attempt.trainingId,
      },
    }),
    isPassed
      ? issueCertificateForAttempt({
          attemptId: attempt.id,
          userId: dbUser.id,
          trainingId: attempt.trainingId,
          organizationId,
          periodId: attempt.assignment.periodId ?? null,
          trainingTitle: attempt.training.title,
          renewalPeriodMonths: attempt.training.renewalPeriodMonths,
          recipientEmail: dbUser.email,
          recipientFullName: `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim(),
        }).catch(err => {
          logger.error('ExamSubmit', 'Sertifika üretilemedi', { err, attemptId: attempt.id })
        })
      : Promise.resolve(),
    isPassed && attempt.training.smgPoints > 0
      ? (async () => {
          const defaultCategory = await prisma.smgCategory.findFirst({ // perf-check-disable-line
            where: { organizationId: attempt.training.organizationId, code: 'COURSE_COMPLETION', isActive: true },
            select: { id: true },
          })
          const today = new Date()
          const completionDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
          await prisma.smgActivity.upsert({
            where: {
              userId_activityType_title_completionDate: {
                userId: dbUser.id,
                activityType: 'COURSE_COMPLETION',
                title: attempt.training.title,
                completionDate,
              },
            },
            create: {
              userId: dbUser.id,
              organizationId: attempt.training.organizationId,
              activityType: 'COURSE_COMPLETION',
              categoryId: defaultCategory?.id ?? null,
              title: attempt.training.title,
              provider: attempt.training.organization.name,
              completionDate,
              smgPoints: attempt.training.smgPoints,
              approvalStatus: 'APPROVED',
              approvedAt: new Date(),
            },
            update: {},
          })
        })().catch(err => logger.error('SMG', 'Otomatik SMG aktivitesi oluşturulamadı', { err, attemptId: attempt.id }))
      : Promise.resolve(),
    createAuditLog({
      userId: dbUser.id,
      organizationId: attempt.training.organizationId,
      action: isPassed ? 'exam.passed' : 'exam.failed',
      entityType: 'exam_attempt',
      entityId: attempt.id,
      newData: { score, isPassed, trainingId: attempt.trainingId, tabSwitchCount, suspicious, questionsChangedMidExam: droppedAnswers.length > 0 },
    }),
    logActivity({
      userId: dbUser.id,
      organizationId: attempt.training.organizationId,
      action: isPassed ? 'exam_pass' : 'exam_fail',
      resourceType: 'exam_attempt',
      resourceId: attempt.id,
      resourceTitle: attempt.training.title,
      metadata: { score, passingScore: attempt.training.passingScore, attemptNumber: attempt.attemptNumber, tabSwitchCount, suspicious },
    }),
    invalidateDashboardCache(attempt.training.organizationId).catch(() => {}),
  ])

  // EY.FR.40 geri bildirim gerekli mi? — feedback/status ile aynı kuralı uygular.
  // Fire-and-forget: hata olursa feedbackRequired=false, akış bozulmaz.
  // (Transition page yine /api/feedback/status'u çağırıp doğrular; bu erken sinyaldir.)
  let feedbackRequired = false
  if (phase === 'post') {
    try {
      const activeFormExists = !!(await prisma.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true, isArchived: false },
        select: { id: true },
      }))
      feedbackRequired =
        activeFormExists &&
        isAttemptFeedbackTriggered(
          { status: 'completed', isPassed, attemptNumber: attempt.attemptNumber },
          attempt.assignment.originalMaxAttempts,
        )
    } catch (err) {
      logger.warn('ExamSubmit', 'feedbackRequired check failed', { err: (err as Error).message })
    }
  }

  const attemptsRemaining = isPassed ? 0 : Math.max(0, effectiveMaxAttempts - attempt.attemptNumber)

  return jsonResponse({
    phase: 'post',
    score,
    isPassed,
    passingScore: attempt.training.passingScore,
    attemptsRemaining,
    // Güvenlik: kullanıcı geçemediyse doğru cevapları/işaretlemelerini dönme.
    // Aksi halde başarısız personel sonuç ekranından doğru cevapları ezberleyip
    // sonraki denemede kolayca geçebilir.
    results: isPassed ? questionResults : undefined,
    feedbackRequired,
  })
}, { requireOrganization: true })
