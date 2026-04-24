import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
} from '@/lib/api-helpers'
import { updateQuestionBankSchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateQuestionBankSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  const existing = await prisma.questionBank.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'question_bank.update',
    entityType: 'question_bank',
    entityId: id,
    oldData: { text: existing.text },
    newData: { text: question.text },
    request,
  })

  return jsonResponse(question)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const existing = await prisma.questionBank.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!existing) return errorResponse('Soru bulunamadı', 404)

  // Cascade delete (QuestionBankOption ON DELETE CASCADE) — multi-tenant güvenli
  const deleted = await prisma.questionBank.deleteMany({ where: { id, organizationId: dbUser!.organizationId! } })
  if (deleted.count === 0) return errorResponse('Soru bulunamadi veya yetkiniz yok', 404)

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'question_bank.delete',
    entityType: 'question_bank',
    entityId: id,
    oldData: { text: existing.text, category: existing.category },
    request,
  })

  return jsonResponse({ success: true })
}
