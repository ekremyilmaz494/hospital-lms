import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateOrganizationSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const hospital = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      users: { orderBy: { createdAt: 'desc' }, take: 10 },
      trainings: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { users: true, trainings: true, auditLogs: true } },
    },
  })

  if (!hospital) return errorResponse('Hospital not found', 404)

  return jsonResponse(hospital)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = updateOrganizationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const oldData = await prisma.organization.findUnique({ where: { id } })
  if (!oldData) return errorResponse('Hospital not found', 404)

  const hospital = await prisma.organization.update({
    where: { id },
    data: parsed.data,
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'update',
    entityType: 'organization',
    entityId: id,
    oldData,
    newData: hospital,
    request,
  })

  return jsonResponse(hospital)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const oldData = await prisma.organization.findUnique({ where: { id } })
  if (!oldData) return errorResponse('Hospital not found', 404)

  await prisma.organization.delete({ where: { id } })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'delete',
    entityType: 'organization',
    entityId: id,
    oldData,
    request,
  })

  return jsonResponse({ success: true })
}
