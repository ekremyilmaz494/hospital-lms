import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createDepartmentSchema } from '@/lib/validations'
import { invalidateOrgCache } from '@/lib/redis'

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
    parentId: d.parentId,
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

  const { name, description, color, sortOrder, parentId } = parsed.data

  // Aynı parent altında aynı isimde departman var mı kontrol et.
  // Schema: (orgId, name) artık global unique değil — parent farketmediği için
  // farklı parent altındaki aynı isim serbest. parentId null = kök departman seviyesi.
  const existing = await prisma.department.findFirst({
    where: {
      organizationId,
      name,
      parentId: parentId ?? null,
    },
    select: { id: true },
  })

  if (existing) {
    return errorResponse(
      parentId
        ? 'Bu isimde bir alt departman bu üst departman altında zaten mevcut'
        : 'Bu isimde bir kök departman zaten mevcut',
      409,
    )
  }

  // Max 2 seviye kuralı: parent kendisi child ise yeni departman 3. seviyede olur — yasak.
  if (parentId) {
    const parent = await prisma.department.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true, parentId: true },
    })
    if (!parent) {
      return errorResponse('Üst departman bulunamadı', 404)
    }
    if (parent.parentId) {
      return errorResponse('Alt departmanın altına yeni departman eklenemez (max 2 seviye)', 400)
    }
  }

  const department = await prisma.department.create({
    data: {
      organizationId,
      name,
      description: description || null,
      color: color || '#0d9668',
      sortOrder: sortOrder ?? 0,
      parentId: parentId ?? null,
    },
    include: {
      _count: { select: { users: true } },
    },
  })

  await audit({
    action: 'department.create',
    entityType: 'department',
    entityId: department.id,
    newData: { name, color, parentId: parentId ?? null },
  })

  // Staff API cevabı departman listesini içerdiği için aynı cache anahtarlarını temizle
  await invalidateOrgCache(organizationId, 'staff').catch(() => { /* best-effort */ })

  revalidatePath('/admin/departments')

  return jsonResponse(department, 201)
}, { requireOrganization: true })
