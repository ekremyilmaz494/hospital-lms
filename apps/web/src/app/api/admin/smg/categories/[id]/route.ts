import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { updateSmgCategorySchema } from '@/lib/validations'

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateSmgCategorySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgCategory.findFirst({
    where: { id, organizationId },
  })
  if (!existing) return errorResponse('Kategori bulunamadı', 404)

  // Kod değişiyorsa unique kontrol
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const clash = await prisma.smgCategory.findFirst({
      where: { organizationId, code: parsed.data.code, NOT: { id } },
      select: { id: true },
    })
    if (clash) return errorResponse('Bu kod ile başka bir kategori mevcut', 409)
  }

  const updated = await prisma.smgCategory.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.code !== undefined && { code: parsed.data.code }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.maxPointsPerActivity !== undefined && { maxPointsPerActivity: parsed.data.maxPointsPerActivity }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  })

  await audit({
    action: 'UPDATE',
    entityType: 'SmgCategory',
    entityId: id,
    oldData: existing,
    newData: updated,
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params

  const [existing, linkedCount] = await Promise.all([
    prisma.smgCategory.findFirst({
      where: { id, organizationId },
    }),
    prisma.smgActivity.count({
      where: { categoryId: id, organizationId },
    }),
  ])
  if (!existing) return errorResponse('Kategori bulunamadı', 404)

  if (linkedCount > 0) {
    return errorResponse(
      `Bu kategoriye bağlı ${linkedCount} aktivite bulunmaktadır. Önce aktiviteleri başka kategoriye taşıyın.`,
      409
    )
  }

  await prisma.smgCategory.delete({ where: { id } })

  await audit({
    action: 'DELETE',
    entityType: 'SmgCategory',
    entityId: id,
    oldData: existing,
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
