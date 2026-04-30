import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
  safePagination,
} from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createContentLibrarySchema } from '@/lib/validations'

/** GET /api/super-admin/content-library — tüm içerikleri listele */
export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams, 200)
  const category = searchParams.get('category')
  const difficulty = searchParams.get('difficulty')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category
  if (difficulty) where.difficulty = difficulty
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

  const [items, total] = await Promise.all([
    prisma.contentLibrary.findMany({
      where,
      include: {
        _count: { select: { installs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contentLibrary.count({ where }),
  ])

  return jsonResponse({
    items: items.map(item => ({
      ...item,
      targetRoles: item.targetRoles as string[],
      installCount: item._count.installs,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
})

/** POST /api/super-admin/content-library — yeni içerik ekle */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = createContentLibrarySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(`Eksik veya hatalı bilgi: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400)
  }

  const item = await prisma.contentLibrary.create({
    data: {
      ...parsed.data,
      targetRoles: parsed.data.targetRoles,
      createdById: dbUser.id,
    },
  })

  await audit({
    action: 'content_library.create',
    entityType: 'content_library',
    entityId: item.id,
    newData: { title: item.title, category: item.category },
  })

  return jsonResponse(item, 201)
})
