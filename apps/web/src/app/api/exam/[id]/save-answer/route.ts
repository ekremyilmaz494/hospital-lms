import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { withStaffRoute } from '@/lib/api-handler'
import { resolveExamFlowState } from '@/lib/exam-flow-resolver'
import { getStaffOrgIds } from '@/lib/staff-orgs'
import { logger } from '@/lib/logger'

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

  // Aktif attempt — tek doğruluk kaynağı resolveExamFlowState (atama önce
  // kanonikleştirilir, attempt atamaya scope'lanır; atamalar-arası attemptNumber
  // sıralaması yok — N1). organizationId resolver'ın her sorgusunda WHERE'de.
  const requiredStatus = body.examPhase === 'pre' ? 'pre_exam' : 'post_exam'
  // Ortak personel: doktor B hastanesindeki sınavını da çözebilsin (tekil-org'da [A] → =A, inert).
  const myOrgs = await getStaffOrgIds(dbUser.id, organizationId)
  const flow = await resolveExamFlowState(id, dbUser.id, myOrgs)
  const attempt =
    flow.activeAttempt && flow.activeAttempt.status === requiredStatus ? flow.activeAttempt : null
  if (!attempt) return errorResponse('Aktif sınav denemesi bulunamadı', 404)

  // Soru + şık üyelik doğrulaması — tek sorgu hem questionId'nin bu denemenin
  // eğitimine ait olduğunu hem de selectedOptionId'nin o soruya ait olduğunu
  // teyit eder. Aksi halde başka eğitim/soru ID'leriyle junk examAnswer kaydı
  // yazılabilir (cross-training cevap kirliliği).
  const question = await prisma.question.findFirst({
    where: { id: body.questionId, trainingId: attempt.trainingId },
    select: { options: { where: { id: body.selectedOptionId }, select: { id: true } } },
  })
  if (!question || question.options.length === 0) {
    return errorResponse('Soru veya seçenek bu sınava ait değil', 400)
  }

  // Upsert answer (attemptId + questionId + examPhase)
  const existing = await prisma.examAnswer.findFirst({
    where: { attemptId: attempt.id, questionId: body.questionId, examPhase: body.examPhase },
  })

  if (existing) {
    // Cevaplar sınav gönderilene kadar serbestçe değiştirilebilir — son sınavda
    // soru başına süre kilidi yoktur. Gerçek sınav süresi attempt timer'ı +
    // autoCompleteExpiredAttempt ile zorlanır; skor submit anında DB'den hesaplanır.
    // Gözlemlenebilirlik: aynı soruya ~2sn içinde farklı bir cevap gelmesi, sınavın
    // birden fazla sekmede açık olduğuna işaret edebilir (frontend tab-lock'a rağmen).
    const sinceLastMs = Date.now() - new Date(existing.answeredAt).getTime()
    if (sinceLastMs < 2_000 && existing.selectedOptionId !== body.selectedOptionId) {
      logger.warn('SaveAnswer', 'Rapid answer overwrite — possible concurrent tab', {
        attemptId: attempt.id,
        questionId: body.questionId,
        examPhase: body.examPhase,
      })
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
