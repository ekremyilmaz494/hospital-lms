import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createPlanSchema, updatePlanSchema, createSubscriptionSchema } from '@/lib/validations'

// ── Subscription Plans CRUD ──

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // plans | subscriptions

  if (type === 'subscriptions') {
    const { page, limit, skip } = safePagination(searchParams)
    const [subscriptions, total] = await Promise.all([
      prisma.organizationSubscription.findMany({
        include: { organization: true, plan: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organizationSubscription.count(),
    ])
    return jsonResponse({ subscriptions, total, page, limit })
  }

  // Planlar sayısı genellikle düşük (~10-20) ama yine de limit koy
  const plans = await prisma.subscriptionPlan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return jsonResponse(plans)
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'subscription') {
    const parsed = createSubscriptionSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.message)

    const sub = await prisma.organizationSubscription.create({
      data: {
        ...parsed.data,
        createdBy: dbUser!.id,
        trialEndsAt: parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      action: 'create',
      entityType: 'subscription',
      entityId: sub.id,
      newData: sub,
      request,
    })

    return jsonResponse(sub, 201)
  }

  // Default: create plan
  const parsed = createPlanSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const plan = await prisma.subscriptionPlan.create({
    data: {
      ...parsed.data,
      features: JSON.parse(JSON.stringify(parsed.data.features)),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'create',
    entityType: 'subscription_plan',
    entityId: plan.id,
    newData: plan,
    request,
  })

  return jsonResponse(plan, 201)
}

export async function PATCH(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody<{ id: string; [key: string]: unknown }>(request)
  if (!body?.id) return errorResponse('ID required')

  const parsed = updatePlanSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const oldPlan = await prisma.subscriptionPlan.findUnique({ where: { id: body.id } })
  if (!oldPlan) return errorResponse('Plan bulunamadı', 404)

  const plan = await prisma.subscriptionPlan.update({
    where: { id: body.id },
    data: {
      ...parsed.data,
      features: parsed.data.features ? JSON.parse(JSON.stringify(parsed.data.features)) : undefined,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    action: 'update',
    entityType: 'subscription_plan',
    entityId: plan.id,
    oldData: oldPlan,
    newData: plan,
    request,
  })

  return jsonResponse(plan)
}
