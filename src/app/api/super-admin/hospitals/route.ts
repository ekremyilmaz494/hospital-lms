import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createOrganizationSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams, 500)
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

  // planId verilmişse planın var olduğunu doğrula
  const { planId, trialDays, ...orgData } = parsed.data
  if (planId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan) return errorResponse('Belirtilen abonelik planı bulunamadı', 404)
  }

  // Organizasyon + abonelik aynı transaction içinde oluştur
  const hospital = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { ...orgData, createdBy: dbUser!.id },
    })

    if (planId) {
      const trialEndsAt = trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null

      await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId,
          status: trialEndsAt ? 'trialing' : 'active',
          billingCycle: 'monthly',
          ...(trialEndsAt && { trialEndsAt }),
        },
      })
    }

    return org
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'create',
    entityType: 'organization',
    entityId: hospital.id,
    newData: { ...hospital, planId, trialDays },
    request,
  })

  return jsonResponse(hospital, 201)
}
