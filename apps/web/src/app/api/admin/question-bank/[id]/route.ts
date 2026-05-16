import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { updateQuestionBankSchema } from '@/lib/validations'

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateQuestionBankSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  const existing = await prisma.questionBank.findFirst({
    where: { id, organizationId },
  })
  if (!existing) return errorResponse('Soru bulunamadı', 404)

  // Options varsa doğru şık kontrolü
  if (parsed.data.options) {
    const correctCount = parsed.data.options.filter((o) => o.isCorrect).length
    if (correctCount !== 1) {
      return errorResponse('Her soruda tam olarak 1 doğru şık olmalıdır', 400)
    }
  }

  const { options, ...questionData } = parsed.data

  const question = await prisma.$transaction(async (tx) => {
    // Options varsa sil ve yeniden oluştur
    if (options) {
      await tx.questionBankOption.deleteMany({
        where: { questionBankId: id },
      })
      await tx.questionBankOption.createMany({
        data: options.map((o, idx) => ({
          questionBankId: id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: o.order ?? idx,
        })),
      })
    }

    return tx.questionBank.update({
      where: { id },
      data: questionData,
      include: { options: { orderBy: { order: 'asc' } } },
    })
  })

  await audit({
    action: 'question_bank.update',
    entityType: 'question_bank',
    entityId: id,
    oldData: { text: existing.text },
    newData: { text: question.text },
  })

  return jsonResponse(question)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params

  const existing = await prisma.questionBank.findFirst({
    where: { id, organizationId },
  })
  if (!existing) return errorResponse('Soru bulunamadı', 404)

  // Cascade delete (QuestionBankOption ON DELETE CASCADE) — multi-tenant güvenli
  const deleted = await prisma.questionBank.deleteMany({ where: { id, organizationId } })
  if (deleted.count === 0) return errorResponse('Soru bulunamadi veya yetkiniz yok', 404)

  await audit({
    action: 'question_bank.delete',
    entityType: 'question_bank',
    entityId: id,
    oldData: { text: existing.text, category: existing.category },
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
