import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { submitEvaluationSchema } from '@/lib/validations'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const { id } = await params
  const userId = dbUser!.id

  const evaluation = await prisma.competencyEvaluation.findFirst({
    where: {
      id,
      evaluatorId: userId,
      form: { organizationId: dbUser!.organizationId! },
    },
    include: {
      form: {
        include: {
          categories: { include: { items: true } },
        },
      },
    },
  })

  if (!evaluation) return errorResponse('Değerlendirme bulunamadı', 404)
  if (evaluation.status === 'COMPLETED') return errorResponse('Bu değerlendirme zaten tamamlandı', 400)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = submitEvaluationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  // Tüm item ID'lerini doğrula
  const allItemIds = new Set(
    evaluation.form.categories.flatMap(c => c.items.map(i => i.id))
  )
  for (const answer of parsed.data.answers) {
    if (!allItemIds.has(answer.itemId)) {
      return errorResponse(`Geçersiz madde ID: ${answer.itemId}`, 400)
    }
  }

  // Cevapları upsert et
  await prisma.$transaction(async (tx) => {
    for (const answer of parsed.data.answers) {
      await tx.competencyAnswer.upsert({
        where: { evaluationId_itemId: { evaluationId: id, itemId: answer.itemId } },
        create: { evaluationId: id, itemId: answer.itemId, score: answer.score, comment: answer.comment },
        update: { score: answer.score, comment: answer.comment },
      })
    }

    // Genel skor hesapla (tüm verilen cevapların ortalaması)
    const allAnswers = await tx.competencyAnswer.findMany({ where: { evaluationId: id } })
    const overallScore = allAnswers.length > 0
      ? allAnswers.reduce((s, a) => s + a.score, 0) / allAnswers.length
      : null

    await tx.competencyEvaluation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        overallScore: overallScore ?? undefined,
      },
    })
  })

  // Değerlendirilen kişiye bildirim
  await prisma.notification.create({
    data: {
      userId: evaluation.subjectId,
      organizationId: dbUser!.organizationId!,
      title: 'Değerlendirme Tamamlandı',
      message: `"${evaluation.form.title}" formu kapsamında bir değerlendirici değerlendirmesini tamamladı.`,
      type: 'competency_evaluation',
    },
  })

  return jsonResponse({ success: true })
}
