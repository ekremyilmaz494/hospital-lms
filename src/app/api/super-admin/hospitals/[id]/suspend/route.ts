import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody<{ reason?: string }>(request)

  const hospital = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: true,
      suspendedReason: body?.reason ?? null,
      suspendedAt: new Date(),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'suspend',
    entityType: 'organization',
    entityId: id,
    newData: { reason: body?.reason },
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

  const hospital = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: false,
      suspendedReason: null,
      suspendedAt: null,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'unsuspend',
    entityType: 'organization',
    entityId: id,
    request,
  })

  return jsonResponse(hospital)
}
