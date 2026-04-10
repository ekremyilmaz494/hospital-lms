import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateSmgPeriodSchema } from '@/lib/validations'

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

  const parsed = updateSmgPeriodSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const period = await prisma.smgPeriod.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })

  if (!period) return errorResponse('Dönem bulunamadı', 404)

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate !== undefined) updateData.endDate = new Date(parsed.data.endDate)
  if (parsed.data.requiredPoints !== undefined) updateData.requiredPoints = parsed.data.requiredPoints
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive

  const updated = await prisma.smgPeriod.update({
    where: { id },
    data: updateData,
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'UPDATE',
    entityType: 'SmgPeriod',
    entityId: id,
    oldData: period,
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

  const period = await prisma.smgPeriod.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })

  if (!period) return errorResponse('Dönem bulunamadı', 404)

  // Check if any activities are linked to this period's date range
  const linkedActivities = await prisma.smgActivity.count({
    where: {
      organizationId: dbUser!.organizationId!,
      completionDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
  })

  if (linkedActivities > 0) {
    return errorResponse(
      `Bu döneme bağlı ${linkedActivities} aktivite bulunmaktadır. Önce aktiviteleri silin veya taşıyın.`,
      409
    )
  }

  await prisma.smgPeriod.delete({ where: { id } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'DELETE',
    entityType: 'SmgPeriod',
    entityId: id,
    oldData: period,
    request,
  })

  return jsonResponse({ success: true })
}
