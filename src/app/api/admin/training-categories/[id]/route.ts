import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateTrainingCategorySchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const category = await prisma.trainingCategory.findUnique({
    where: { id },
    select: { id: true, organizationId: true, value: true, label: true },
  })

  if (!category || category.organizationId !== dbUser!.organizationId!) {
    return errorResponse('Kategori bulunamadı', 404)
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateTrainingCategorySchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(firstIssue?.message ?? 'Geçersiz veri', 400)
  }

  const updated = await prisma.trainingCategory.update({
    where: { id },
    data: parsed.data,
    select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'training_category.update',
    entityType: 'training_category',
    entityId: id,
    oldData: { label: category.label },
    newData: parsed.data,
    request,
  })

  return jsonResponse(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const category = await prisma.trainingCategory.findUnique({
    where: { id },
    select: { id: true, organizationId: true, value: true, label: true },
  })

  if (!category || category.organizationId !== dbUser!.organizationId!) {
    return errorResponse('Kategori bulunamadı', 404)
  }

  // Bu kategoriye bağlı eğitim var mı?
  const trainingCount = await prisma.training.count({
    where: {
      organizationId: dbUser!.organizationId!,
      category: category.value,
    },
  })

  if (trainingCount > 0) {
    return errorResponse(
      `Bu kategoride ${trainingCount} eğitim var, önce eğitimleri başka kategoriye taşıyın`,
      409
    )
  }

  await prisma.trainingCategory.delete({ where: { id } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'training_category.delete',
    entityType: 'training_category',
    entityId: id,
    oldData: { label: category.label, value: category.value },
    request,
  })

  return jsonResponse({ success: true })
}
