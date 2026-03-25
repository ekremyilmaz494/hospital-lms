import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateUserSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const staff = await prisma.user.findFirst({
    where: { id, organizationId: dbUser!.organizationId },
    include: {
      assignments: {
        include: { training: true, examAttempts: true },
        orderBy: { assignedAt: 'desc' },
      },
      _count: { select: { assignments: true, examAttempts: true } },
    },
  })

  if (!staff) return errorResponse('Staff not found', 404)

  return jsonResponse(staff)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  // role ve organizationId değiştirilmesini engelle — privilege escalation önlemi
  const safeSchema = updateUserSchema.omit({ role: true, organizationId: true })
  const parsed = safeSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId } })
  if (!existing) return errorResponse('Staff not found', 404)

  const dataToUpdate = { ...parsed.data }
  if (dataToUpdate.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: dataToUpdate.departmentId } })
    if (dept) {
      dataToUpdate.department = dept.name
    }
  }

  const staff = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'update',
    entityType: 'user',
    entityId: id,
    oldData: existing,
    newData: staff,
    request,
  })

  return jsonResponse(staff)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId } })
  if (!existing) return errorResponse('Staff not found', 404)

  // Soft delete — deactivate
  await prisma.user.update({ where: { id }, data: { isActive: false } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'deactivate',
    entityType: 'user',
    entityId: id,
    request,
  })

  return jsonResponse({ success: true })
}
