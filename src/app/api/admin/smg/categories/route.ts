import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withApiHandler, withAdminRoute } from '@/lib/api-handler'
import { createSmgCategorySchema } from '@/lib/validations'

// Hem admin hem staff kategorileri okuyabilmeli (staff aktivite ekleme dropdown'u)
export const GET = withApiHandler(async ({ dbUser, organizationId }) => {
  const isStaff = dbUser.role === 'staff'
  const categories = await prisma.smgCategory.findMany({
    where: {
      organizationId,
      ...(isStaff ? { isActive: true } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      maxPointsPerActivity: true,
      isActive: true,
      sortOrder: true,
    },
  })

  return jsonResponse(
    { categories },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
  )
}, { roles: ['admin', 'staff', 'super_admin'], requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgCategorySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgCategory.findFirst({
    where: { organizationId, code: parsed.data.code },
    select: { id: true },
  })
  if (existing) return errorResponse('Bu kod ile bir kategori zaten mevcut', 409)

  const category = await prisma.smgCategory.create({
    data: {
      organizationId,
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
      maxPointsPerActivity: parsed.data.maxPointsPerActivity ?? null,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  })

  await audit({
    action: 'CREATE',
    entityType: 'SmgCategory',
    entityId: category.id,
    newData: category,
  })

  return jsonResponse(category, 201)
}, { requireOrganization: true })
