import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateSmgTargetSchema } from '@/lib/validations'

export async function PUT(
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

  const parsed = updateSmgTargetSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgTarget.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!existing) return errorResponse('Hedef bulunamadı', 404)

  const updated = await prisma.smgTarget.update({
    where: { id },
    data: { requiredPoints: parsed.data.requiredPoints },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'UPDATE',
    entityType: 'SmgTarget',
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

  const existing = await prisma.smgTarget.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!existing) return errorResponse('Hedef bulunamadı', 404)

  await prisma.smgTarget.delete({ where: { id } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'DELETE',
    entityType: 'SmgTarget',
    entityId: id,
    oldData: existing,
    request,
  })

  return jsonResponse({ success: true })
}
