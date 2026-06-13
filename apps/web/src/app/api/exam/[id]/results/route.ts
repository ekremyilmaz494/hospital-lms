import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getEffectiveExamQuestions } from '@/lib/exam-helpers'

/**
 * Post-exam soru bazlı sonuç dökümü — transition result ekranı için replay kaynağı.
 *
 * Güvenlik: submit response'uyla aynı politika. Sadece başarılı (isPassed=true)
 * denemelerde doğru/yanlış cevap detayı gösterilir; aksi halde personel başarısız
 * denemede doğru cevapları görüp bir sonraki girişte ezberleyebilir.
 *
 * Path `[id]` hem attemptId hem assignmentId kabul eder (submit'in aradığı gibi).
 */
export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  // attemptId veya assignmentId ile dene; her iki durumda da org + ownership zorunlu.
  // attemptNumber + assignment.maxAttempts + training.maxAttempts: attemptsRemaining
  // hesabı için submit/route.ts:243-246 ile aynı mantık.
  let attempt = await prisma.examAttempt.findFirst({
    where: {
      id,
      userId: dbUser.id,
      training: { organizationId },
    },
    select: {
      id: true,
      trainingId: true,
      isPassed: true,
      status: true,
      postExamScore: true,
      attemptNumber: true,
      training: {
        select: {
          passingScore: true,
          maxAttempts: true,
          // getEffectiveExamQuestions için — submit ile aynı subset hesabı.
          examOnly: true,
          randomizeQuestions: true,
          randomQuestionCount: true,
        },
      },
      assignment: { select: { maxAttempts: true } },
    },
  })
  if (!attempt) {
    // Tek atamaya scope'lu + attemptNumber desc — N1 riski yok (resolver
    // burada uygun değil: aktif değil, TAMAMLANMIŞ son deneme aranıyor).
    attempt = await prisma.examAttempt.findFirst({ // perf-check-disable-line
      where: {
        assignmentId: id,
        userId: dbUser.id,
        status: 'completed',
        training: { organizationId },
      },
      select: {
        id: true,
        trainingId: true,
        isPassed: true,
        status: true,
        postExamScore: true,
        attemptNumber: true,
        training: {
        select: {
          passingScore: true,
          maxAttempts: true,
          // getEffectiveExamQuestions için — submit ile aynı subset hesabı.
          examOnly: true,
          randomizeQuestions: true,
          randomQuestionCount: true,
        },
      },
        assignment: { select: { maxAttempts: true } },
      },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Sınav sonucu bulunamadı', 404)
  if (attempt.status !== 'completed') {
    return errorResponse('Sınav henüz tamamlanmadı', 400)
  }

  // attemptsRemaining: submit/route.ts:243-246 ile birebir aynı mantık.
  // Passed olduysa kalan deneme önemsiz (0). Aksi halde tavan - mevcut numara.
  const effectiveMaxAttempts = attempt.assignment.maxAttempts ?? attempt.training.maxAttempts
  const attemptsRemaining = attempt.isPassed
    ? 0
    : Math.max(0, effectiveMaxAttempts - attempt.attemptNumber)

  // Başarısızsa soru detaylarını döndürme (anti-cheating)
  if (!attempt.isPassed) {
    return jsonResponse(
      {
        isPassed: false,
        score: attempt.postExamScore !== null ? Number(attempt.postExamScore) : 0,
        passingScore: attempt.training.passingScore,
        attemptsRemaining,
        results: null,
      },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  }

  // Submit response'uyla birebir aynı şekil + AYNI soru kümesi. examOnly +
  // randomQuestionCount aktifken kullanıcı alt-küme görür; results TÜM soruları
  // dökerse transition ekranındaki soru sayısı/sırası submit'le tutarsız olur.
  // getEffectiveExamQuestions Fisher-Yates seed shuffle kullanır ve giriş
  // sırasına bağımlıdır → findMany `orderBy: sortOrder` ŞART.
  const [allQuestions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { trainingId: attempt.trainingId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        questionText: true,
        options: { select: { id: true, optionText: true, isCorrect: true } },
      },
    }),
    prisma.examAnswer.findMany({
      where: { attemptId: attempt.id, examPhase: 'post' },
      select: { questionId: true, selectedOptionId: true },
    }),
  ])

  // submit/route.ts ile aynı seed (attempt.id + 'post') → birebir aynı subset/sıra.
  const questions = getEffectiveExamQuestions(allQuestions, attempt.training, attempt.id, 'post')

  const answerByQuestion = new Map(answers.map(a => [a.questionId, a.selectedOptionId]))

  const results = questions
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(q => {
      const selectedOptionId = answerByQuestion.get(q.id) ?? null
      const correctOption = q.options.find(o => o.isCorrect)
      const selectedOption = selectedOptionId ? q.options.find(o => o.id === selectedOptionId) : null
      return {
        questionText: q.questionText,
        selectedOptionText: selectedOption?.optionText ?? null,
        correctOptionText: correctOption?.optionText ?? null,
        isCorrect: !!(selectedOption && correctOption && selectedOption.id === correctOption.id),
      }
    })

  return jsonResponse(
    {
      isPassed: true,
      score: attempt.postExamScore !== null ? Number(attempt.postExamScore) : 0,
      passingScore: attempt.training.passingScore,
      attemptsRemaining,
      results,
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
