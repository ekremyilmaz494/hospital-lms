import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { updateTrainingCategorySchema } from '@/lib/validations'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params
  if (!UUID_REGEX.test(id)) return errorResponse('Geçersiz kategori ID', 400)

  const category = await prisma.trainingCategory.findUnique({ // perf-check-disable-line
    where: { id },
    select: { id: true, organizationId: true, value: true, label: true },
  })

  if (!category || category.organizationId !== organizationId) {
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

  await audit({
    action: 'training_category.update',
    entityType: 'training_category',
    entityId: id,
    oldData: { label: category.label },
    newData: parsed.data,
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params
  if (!UUID_REGEX.test(id)) return errorResponse('Geçersiz kategori ID', 400)

  const category = await prisma.trainingCategory.findUnique({ // perf-check-disable-line
    where: { id },
    select: { id: true, organizationId: true, value: true, label: true },
  })

  if (!category || category.organizationId !== organizationId) {
    return errorResponse('Kategori bulunamadı', 404)
  }

  // Bu kategoriye bağlı eğitim var mı?
  const trainingCount = await prisma.training.count({
    where: {
      organizationId,
      category: category.value,
    },
  })

  if (trainingCount > 0) {
    return errorResponse(
      `Bu kategoride ${trainingCount} eğitim var, önce eğitimleri başka kategoriye taşıyın`,
      409
    )
  }

  const deleted = await prisma.trainingCategory.deleteMany({ where: { id, organizationId } })
  if (deleted.count === 0) return errorResponse('Kategori bulunamadi veya yetkiniz yok', 404)

  await audit({
    action: 'training_category.delete',
    entityType: 'training_category',
    entityId: id,
    oldData: { label: category.label, value: category.value },
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
