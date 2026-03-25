import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateDepartmentSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/departments/[id] — Departman detayı + personelleri
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const department = await prisma.department.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: {
      users: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          phone: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
        },
        orderBy: { firstName: 'asc' },
      },
      _count: { select: { users: true } },
    },
  })

  if (!department) return errorResponse('Departman bulunamadı', 404)

  return jsonResponse(department)
}

// PATCH /api/admin/departments/[id] — Departman güncelle
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid request body')

  const parsed = updateDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const existing = await prisma.department.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })

  if (!existing) return errorResponse('Departman bulunamadı', 404)

  // İsim değişiyorsa çakışma kontrolü
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.department.findUnique({
      where: {
        organizationId_name: {
          organizationId: dbUser!.organizationId!,
          name: parsed.data.name,
        },
      },
    })
    if (duplicate) return errorResponse('Bu isimde bir departman zaten mevcut', 409)
  }

  const department = await prisma.department.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { users: true } } },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'department.update',
    entityType: 'department',
    entityId: id,
    oldData: { name: existing.name, color: existing.color },
    newData: parsed.data,
  })

  return jsonResponse(department)
}

// DELETE /api/admin/departments/[id] — Departman sil
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const department = await prisma.department.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: { _count: { select: { users: true } } },
  })

  if (!department) return errorResponse('Departman bulunamadı', 404)

  // Personellerin departmentId'sini null yap, sonra departmanı sil
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null, department: null },
    }),
    prisma.department.delete({ where: { id } }),
  ])

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'department.delete',
    entityType: 'department',
    entityId: id,
    oldData: { name: department.name, staffCount: department._count.users },
  })

  return jsonResponse({ success: true })
}
