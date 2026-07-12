import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import {
  getAttemptWithPhaseCheck,
  getEffectiveExamQuestions,
  shuffle,
  stringToSeed,
} from '@/lib/exam-helpers'
import { getStaffOrgIds } from '@/lib/staff-orgs'

export const GET = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id } = params

  // Phase guard: verify attempt is in correct exam status
  const { searchParams } = new URL(request.url)
  const phase = searchParams.get('phase')
  if (!phase || !['pre', 'post'].includes(phase)) {
    return errorResponse('phase parametresi zorunludur (pre veya post)', 400)
  }
  const requiredStatus = phase === 'pre' ? 'pre_exam' : 'post_exam'
  // Ortak personel: doktor B hastanesindeki sınav sorularına da erişebilsin (tekil-org'da [A] → =A, inert).
  const myOrgs = await getStaffOrgIds(dbUser.id, organizationId)
  const { attempt, error: phaseError } = await getAttemptWithPhaseCheck(id, dbUser.id, [requiredStatus], myOrgs)
  if (phaseError) return phaseError

  // id can be trainingId or assignmentId — find the training
  // Always enforce organizationId to prevent cross-tenant data access (ortak personelde tüm org'ları)
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser.id, training: { organizationId: { in: myOrgs } } },
    include: { training: true },
  })

  let training = assignment?.training ?? null

  // If not found by assignment ID, try as training ID — still enforce org isolation
  if (!training) {
    // Verify the user actually has an assignment for this training in their org(s)
    const assignmentByTraining = await prisma.trainingAssignment.findFirst({
      where: { trainingId: id, userId: dbUser.id, training: { organizationId: { in: myOrgs } } },
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
  const allQuestions = await prisma.question.findMany({
    where: { trainingId: training.id },
    include: {
      options: {
        select: { id: true, optionText: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  // Aynı subset/sırayı submit route'u da kullanır — getEffectiveExamQuestions
  // deterministik seed (attempt.id + phase) ile her iki tarafa eşit küme verir.
  const questions = attempt
    ? getEffectiveExamQuestions(allQuestions, training, attempt.id, phase as 'pre' | 'post')
    : allQuestions

  return jsonResponse({
    trainingTitle: training.title,
    examType: training.examOnly ? 'Sınav' : (phase === 'post' ? 'Son Sınav' : 'Ön Sınav'),
    totalTime: training.examDurationMinutes * 60,
    questions: questions.map((q, idx) => {
      const savedOptionId = savedMap.get(q.id)
      // Şıkları her soru için ayrı ama deterministic karıştır (attempt + questionId bazlı)
      const optionSeed = attempt ? stringToSeed(`${attempt.id}:${phase}:o:${q.id}`) : 0
      const rawOptions = shuffle(q.options, optionSeed)
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
}, { requireOrganization: true })
