import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'

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
      training: { select: { passingScore: true } },
    },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
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
        training: { select: { passingScore: true } },
      },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Sınav sonucu bulunamadı', 404)
  if (attempt.status !== 'completed') {
    return errorResponse('Sınav henüz tamamlanmadı', 400)
  }

  // Başarısızsa soru detaylarını döndürme (anti-cheating)
  if (!attempt.isPassed) {
    return jsonResponse(
      {
        isPassed: false,
        score: attempt.postExamScore !== null ? Number(attempt.postExamScore) : 0,
        passingScore: attempt.training.passingScore,
        results: null,
      },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  }

  // Submit response'uyla birebir aynı şekil için eğitimin TÜM sorularını çek, examAnswer'ı
  // left-join olarak kullan. Boş bırakılan sorular selectedOptionText=null gelmeli; aksi halde
  // transition ekranındaki "atlanmış" sayacı ve soru sırası submit anındakiyle tutarsız olur.
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { trainingId: attempt.trainingId },
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
      results,
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
