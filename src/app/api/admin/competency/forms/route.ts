import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createCompetencyFormSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, skip, search } = safePagination(searchParams)

  const where = {
    organizationId: dbUser!.organizationId!,
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [forms, total] = await Promise.all([
    prisma.competencyForm.findMany({
      where,
      include: {
        _count: { select: { evaluations: true, categories: true } },
        categories: { include: { _count: { select: { items: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.competencyForm.count({ where }),
  ])

  return jsonResponse({ forms, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createCompetencyFormSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { categories, ...formData } = parsed.data

  const form = await prisma.competencyForm.create({
    data: {
      ...formData,
      periodStart: new Date(formData.periodStart),
      periodEnd: new Date(formData.periodEnd),
      organizationId: dbUser!.organizationId!,
      categories: {
        create: categories.map(cat => ({
          name: cat.name,
          weight: cat.weight,
          order: cat.order,
          items: {
            create: cat.items.map(item => ({
              text: item.text,
              description: item.description,
              order: item.order,
            })),
          },
        })),
      },
    },
    include: {
      categories: { include: { items: true } },
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'CREATE',
    entityType: 'CompetencyForm',
    entityId: form.id,
    newData: { title: form.title },
    request,
  })

  return jsonResponse(form, 201)
}
