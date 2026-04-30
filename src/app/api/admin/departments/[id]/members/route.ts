import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { autoAssignByDepartment } from '@/lib/auto-assign'
import type { UserRole } from '@/types/database'

// POST /api/admin/departments/[id]/members — Personel ekle/çıkar
// body: { action: 'add' | 'remove', userIds: string[] }
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id: departmentId } = params

  const body = await parseBody<{ action: 'add' | 'remove'; userIds: string[] }>(request)
  if (!body || !body.action || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return errorResponse('action (add/remove) ve userIds gerekli')
  }

  // Departmanın bu hastaneye ait olduğunu doğrula
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
  })

  if (!department) return errorResponse('Departman bulunamadı', 404)

  if (body.action === 'add') {
    // Personelleri departmana ekle
    await prisma.user.updateMany({
      where: {
        id: { in: body.userIds },
        organizationId,
        role: 'staff' satisfies UserRole,
      },
      data: {
        departmentId,
      },
    })

    // Departman kurallarına göre otomatik eğitim atama
    for (const uid of body.userIds) {
      await autoAssignByDepartment(uid, departmentId, organizationId, dbUser.id)
    }

    await audit({
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
        organizationId,
      },
      data: {
        departmentId: null,
      },
    })

    await audit({
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
}, { requireOrganization: true })
