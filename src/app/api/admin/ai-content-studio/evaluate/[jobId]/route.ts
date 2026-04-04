import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { aiEvaluateSchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError
  const orgId = dbUser!.organizationId!
  const { jobId } = await params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = aiEvaluateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)

  const generation = await prisma.aiGeneration.findFirst({
    where: { id: jobId, organizationId: orgId },
    include: { user: { select: { firstName: true, lastName: true } } },
  })

  if (!generation) return errorResponse('Üretim bulunamadı', 404)

  if (generation.status !== 'completed') {
    return errorResponse('İçerik henüz tamamlanmadı', 400)
  }

  if (generation.savedToLibrary === true) {
    return errorResponse('Kütüphaneye kaydedilmiş içerik değerlendirilemez', 400)
  }

  const updated = await prisma.aiGeneration.update({
    where: { id: jobId },
    data: {
      evaluation: parsed.data.evaluation,
      evaluationNote: parsed.data.note || null,
      evaluatedAt: new Date(),
      evaluatedById: dbUser!.id,
    },
    include: {
      evaluatedBy: { select: { firstName: true, lastName: true } },
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'ai_generation_evaluate',
    entityType: 'AiGeneration',
    entityId: jobId,
    newData: { evaluation: parsed.data.evaluation, note: parsed.data.note },
  })

  logger.info('AI Content Studio', 'AI generation evaluated', { jobId, evaluation: parsed.data.evaluation })

  return jsonResponse({
    jobId: updated.id,
    evaluation: updated.evaluation,
    evaluationNote: updated.evaluationNote,
    evaluatedAt: updated.evaluatedAt,
    evaluatedBy: updated.evaluatedBy
      ? `${updated.evaluatedBy.firstName} ${updated.evaluatedBy.lastName}`.trim()
      : null,
  })
}
