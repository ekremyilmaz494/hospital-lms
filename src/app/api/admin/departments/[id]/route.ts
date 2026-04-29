import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { updateDepartmentSchema } from '@/lib/validations'

// GET /api/admin/departments/[id] — Departman detayı + personelleri
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const department = await prisma.department.findFirst({ // perf-check-disable-line
    where: { id, organizationId },
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

  return jsonResponse(department, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

// PATCH /api/admin/departments/[id] — Departman güncelle
export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid request body')

  const parsed = updateDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const existing = await prisma.department.findFirst({ // perf-check-disable-line
    where: { id, organizationId },
  })

  if (!existing) return errorResponse('Departman bulunamadı', 404)

  // İsim değişiyorsa çakışma kontrolü
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.department.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: parsed.data.name,
        },
      },
    })
    if (duplicate) return errorResponse('Bu isimde bir departman zaten mevcut', 409)
  }

  const department = await prisma.$transaction(async (tx) => {
    const verified = await tx.department.findFirst({ where: { id, organizationId } })
    if (!verified) throw new Error('NOT_FOUND')
    return tx.department.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { users: true } } },
    })
  })

  await audit({
    action: 'department.update',
    entityType: 'department',
    entityId: id,
    oldData: { name: existing.name, color: existing.color },
    newData: parsed.data,
  })

  revalidatePath('/admin/departments')

  return jsonResponse(department)
}, { requireOrganization: true })

// DELETE /api/admin/departments/[id] — Departman sil
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = params

  const department = await prisma.department.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { users: true } } },
  })

  if (!department) return errorResponse('Departman bulunamadı', 404)

  const allowed = await checkRateLimit(`dept-delete:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  // Personellerin departmentId'sini null yap, sonra departmanı sil (multi-tenant güvenli)
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { departmentId: id, organizationId },
      data: { departmentId: null },
    }),
    prisma.department.deleteMany({ where: { id, organizationId } }),
  ])

  await audit({
    action: 'department.delete',
    entityType: 'department',
    entityId: id,
    oldData: { name: department.name, staffCount: department._count.users },
  })

  revalidatePath('/admin/departments')

  return jsonResponse({ success: true })
}, { requireOrganization: true })
