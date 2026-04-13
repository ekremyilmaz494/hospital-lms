import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getAttemptWithPhaseCheck } from '@/lib/exam-helpers'

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  // Phase guard: verify attempt is in correct exam status
  const { searchParams } = new URL(request.url)
  const phase = searchParams.get('phase')
  if (!phase || !['pre', 'post'].includes(phase)) {
    return errorResponse('phase parametresi zorunludur (pre veya post)', 400)
  }
  const requiredStatus = phase === 'pre' ? 'pre_exam' : 'post_exam'
  const { attempt, error: phaseError } = await getAttemptWithPhaseCheck(id, dbUser!.id, [requiredStatus], dbUser!.organizationId!)
  if (phaseError) return phaseError

  // id can be trainingId or assignmentId — find the training
  // Always enforce organizationId to prevent cross-tenant data access
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id, training: { organizationId: dbUser!.organizationId! } },
    include: { training: true },
  })

  let training = assignment?.training ?? null

  // If not found by assignment ID, try as training ID — still enforce org isolation
  if (!training) {
    // Verify the user actually has an assignment for this training in their org
    const assignmentByTraining = await prisma.trainingAssignment.findFirst({
      where: { trainingId: id, userId: dbUser!.id, training: { organizationId: dbUser!.organizationId! } },
      include: { training: true },
    })
    training = assignmentByTraining?.training ?? null
  }

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Onceden kaydedilmis cevaplari getir (auto-save)
  const savedAnswers = attempt ? await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id, examPhase: phase },
    select: { questionId: true, selectedOptionId: true },
  }) : []
  const savedMap = new Map(savedAnswers.map(a => [a.questionId, a.selectedOptionId]))

  // Get questions with options (exclude isCorrect for security)
  let questions = await prisma.question.findMany({
    where: { trainingId: training.id },
    include: {
      options: {
        select: { id: true, optionText: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  // Tüm eğitimlerde soru sırası karıştır (pre + post exam)
  questions = shuffle(questions)

  // examOnly sınavlarda rastgele soru sayısı limiti
  if (training.examOnly && training.randomQuestionCount && training.randomQuestionCount > 0 && training.randomQuestionCount < questions.length) {
    questions = questions.slice(0, training.randomQuestionCount)
  }

  return jsonResponse({
    trainingTitle: training.title,
    examType: training.examOnly ? 'Sınav' : (phase === 'post' ? 'Son Sınav' : 'Ön Sınav'),
    totalTime: training.examDurationMinutes * 60,
    questions: questions.map((q, idx) => {
      const savedOptionId = savedMap.get(q.id)
      // Tüm eğitimlerde şık sırası karıştır
      const rawOptions = shuffle(q.options)
      const options = rawOptions.map((o, oIdx) => ({
        id: String.fromCharCode(97 + oIdx), // a, b, c, d
        optionId: o.id,
        text: o.optionText,
      }))
      // Kaydedilmis cevap varsa, secili option'in id'sini (a,b,c,d) bul
      const savedAnswer = savedOptionId ? options.find(o => o.optionId === savedOptionId)?.id : undefined
      return {
        id: idx + 1,
        questionId: q.id,
        text: q.questionText,
        options,
        savedAnswer,
      }
    }),
  }, 200, { 'Cache-Control': 'no-store' })
}
