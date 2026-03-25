import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createTrainingSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId,
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

  const [trainings, total] = await Promise.all([
    prisma.training.findMany({
      where,
      include: {
        videos: { select: { id: true, title: true, durationSeconds: true, sortOrder: true } },
        _count: { select: { assignments: true, questions: true, videos: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.training.count({ where }),
  ])

  return jsonResponse({ trainings, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createTrainingSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const training = await prisma.training.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      organizationId: dbUser!.organizationId!,
      createdById: dbUser!.id,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'create',
    entityType: 'training',
    entityId: training.id,
    newData: training,
    request,
  })

  return jsonResponse(training, 201)
}
