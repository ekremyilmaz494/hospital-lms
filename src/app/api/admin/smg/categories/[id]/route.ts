import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateSmgCategorySchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateSmgCategorySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgCategory.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!existing) return errorResponse('Kategori bulunamadı', 404)

  // Kod değişiyorsa unique kontrol
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const clash = await prisma.smgCategory.findFirst({
      where: { organizationId: dbUser!.organizationId!, code: parsed.data.code, NOT: { id } },
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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'UPDATE',
    entityType: 'SmgCategory',
    entityId: id,
    oldData: existing,
    newData: updated,
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

  const [existing, linkedCount] = await Promise.all([
    prisma.smgCategory.findFirst({
      where: { id, organizationId: dbUser!.organizationId! },
    }),
    prisma.smgActivity.count({
      where: { categoryId: id, organizationId: dbUser!.organizationId! },
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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'DELETE',
    entityType: 'SmgCategory',
    entityId: id,
    oldData: existing,
    request,
  })

  return jsonResponse({ success: true })
}
