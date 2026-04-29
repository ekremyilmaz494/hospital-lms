import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createDepartmentSchema } from '@/lib/validations'

// GET /api/admin/departments — Departman listesi
export const GET = withAdminRoute(async ({ organizationId }) => {
  const departments = await prisma.department.findMany({
    where: { organizationId },
    include: {
      users: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, title: true }
      },
      _count: { select: { users: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const formatted = departments.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    color: d.color,
    count: d._count.users,
    _count: d._count,
    users: d.users.map(u => ({
      id: u.id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      title: u.title || '',
    })),
    staff: d.users.map(u => ({
      id: u.id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      title: u.title || '',
      initials: `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase(),
    }))
  }))

  return jsonResponse(formatted, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })

// POST /api/admin/departments — Yeni departman oluştur
export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid request body')

  const parsed = createDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const { name, description, color, sortOrder } = parsed.data

  // Aynı isimde departman var mı kontrol et
  const existing = await prisma.department.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  })

  if (existing) {
    return errorResponse('Bu isimde bir departman zaten mevcut', 409)
  }

  const department = await prisma.department.create({
    data: {
      organizationId,
      name,
      description: description || null,
      color: color || '#0d9668',
      sortOrder: sortOrder ?? 0,
    },
    include: {
      _count: { select: { users: true } },
    },
  })

  await audit({
    action: 'department.create',
    entityType: 'department',
    entityId: department.id,
    newData: { name, color },
  })

  revalidatePath('/admin/departments')

  return jsonResponse(department, 201)
}, { requireOrganization: true })
