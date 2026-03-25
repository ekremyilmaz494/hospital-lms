import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

// POST /api/admin/departments/[id]/members — Personel ekle/çıkar
// body: { action: 'add' | 'remove', userIds: string[] }
export async function POST(request: NextRequest, { params }: Params) {
  const { id: departmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<{ action: 'add' | 'remove'; userIds: string[] }>(request)
  if (!body || !body.action || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return errorResponse('action (add/remove) ve userIds gerekli')
  }

  // Departmanın bu hastaneye ait olduğunu doğrula
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId: dbUser!.organizationId! },
  })

  if (!department) return errorResponse('Departman bulunamadı', 404)

  if (body.action === 'add') {
    // Personelleri departmana ekle
    await prisma.user.updateMany({
      where: {
        id: { in: body.userIds },
        organizationId: dbUser!.organizationId!,
        role: 'staff',
      },
      data: {
        departmentId,
        department: department.name,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'department.members.add',
      entityType: 'department',
      entityId: departmentId,
      newData: { userIds: body.userIds, departmentName: department.name },
    })
  } else if (body.action === 'remove') {
    // Personelleri departmandan çıkar
    await prisma.user.updateMany({
      where: {
        id: { in: body.userIds },
        departmentId,
        organizationId: dbUser!.organizationId!,
      },
      data: {
        departmentId: null,
        department: null,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'department.members.remove',
      entityType: 'department',
      entityId: departmentId,
      newData: { userIds: body.userIds },
    })
  } else {
    return errorResponse('action "add" veya "remove" olmalı')
  }

  // Güncel departman verisini döndür
  const updated = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      users: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
        },
        orderBy: { firstName: 'asc' },
      },
      _count: { select: { users: true } },
    },
  })

  return jsonResponse(updated)
}
