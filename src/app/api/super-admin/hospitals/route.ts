import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createOrganizationSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const status = searchParams.get('status') // active | suspended | all

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status === 'active') where.isActive = true
  if (status === 'suspended') where.isSuspended = true

  const [hospitals, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true, trainings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ])

  return jsonResponse({ hospitals, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createOrganizationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.organization.findUnique({ where: { code: parsed.data.code } })
  if (existing) return errorResponse('Bu kod zaten kullanılıyor', 409)

  const hospital = await prisma.organization.create({
    data: { ...parsed.data, createdBy: dbUser!.id },
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'create',
    entityType: 'organization',
    entityId: hospital.id,
    newData: hospital,
    request,
  })

  return jsonResponse(hospital, 201)
}
