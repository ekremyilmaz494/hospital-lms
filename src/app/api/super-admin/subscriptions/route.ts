import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createPlanSchema, updatePlanSchema, createSubscriptionSchema } from '@/lib/validations'

// ── Subscription Plans CRUD ──

export const GET = withSuperAdminRoute(async ({ request }) => {
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
})

export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
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
        createdBy: dbUser.id,
        trialEndsAt: parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    })

    await audit({
      action: 'create',
      entityType: 'subscription',
      entityId: sub.id,
      newData: sub,
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

  await audit({
    action: 'create',
    entityType: 'subscription_plan',
    entityId: plan.id,
    newData: plan,
  })

  return jsonResponse(plan, 201)
})

export const PATCH = withSuperAdminRoute(async ({ request, audit }) => {
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

  await audit({
    action: 'update',
    entityType: 'subscription_plan',
    entityId: plan.id,
    oldData: oldPlan,
    newData: plan,
  })

  return jsonResponse(plan)
})
