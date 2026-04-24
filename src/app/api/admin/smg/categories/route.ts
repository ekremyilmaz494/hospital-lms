import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createSmgCategorySchema } from '@/lib/validations'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // Hem admin hem staff kategorileri okuyabilmeli (staff aktivite ekleme dropdown'u)
  const roleError = requireRole(dbUser!.role, ['admin', 'staff', 'super_admin'])
  if (roleError) return roleError

  const isStaff = dbUser!.role === 'staff'
  const categories = await prisma.smgCategory.findMany({
    where: {
      organizationId: dbUser!.organizationId!,
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
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgCategorySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgCategory.findFirst({
    where: { organizationId: dbUser!.organizationId!, code: parsed.data.code },
    select: { id: true },
  })
  if (existing) return errorResponse('Bu kod ile bir kategori zaten mevcut', 409)

  const category = await prisma.smgCategory.create({
    data: {
      organizationId: dbUser!.organizationId!,
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
      maxPointsPerActivity: parsed.data.maxPointsPerActivity ?? null,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'CREATE',
    entityType: 'SmgCategory',
    entityId: category.id,
    newData: category,
    request,
  })

  return jsonResponse(category, 201)
}
