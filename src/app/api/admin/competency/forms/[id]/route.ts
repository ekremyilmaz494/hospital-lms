import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const form = await prisma.competencyForm.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: {
      categories: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { evaluations: true } },
    },
  })

  if (!form) return errorResponse('Form bulunamadı', 404)
  return jsonResponse(form)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const form = await prisma.competencyForm.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const updated = await prisma.competencyForm.update({
    where: { id },
    data: {
      ...(typeof body.title === 'string' && { title: body.title }),
      ...(typeof body.description === 'string' && { description: body.description }),
      ...(typeof body.targetRole === 'string' && { targetRole: body.targetRole }),
      ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'UPDATE',
    entityType: 'CompetencyForm',
    entityId: id,
    oldData: { isActive: form.isActive },
    newData: { isActive: updated.isActive },
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

  const form = await prisma.competencyForm.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  await prisma.competencyForm.delete({ where: { id } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'DELETE',
    entityType: 'CompetencyForm',
    entityId: id,
    request,
  })

  return jsonResponse({ success: true })
}
