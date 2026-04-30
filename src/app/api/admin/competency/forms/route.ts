import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createCompetencyFormSchema } from '@/lib/validations'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, skip, search } = safePagination(searchParams)

  const where = {
    organizationId,
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
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
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
      organizationId,
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

  await audit({
    action: 'CREATE',
    entityType: 'CompetencyForm',
    entityId: form.id,
    newData: { title: form.title },
  })

  return jsonResponse(form, 201)
}, { requireOrganization: true })
