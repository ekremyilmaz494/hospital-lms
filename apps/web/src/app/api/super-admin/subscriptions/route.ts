import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createPlanSchema, updatePlanSchema, createSubscriptionSchema } from '@/lib/validations'

// ── Subscription Plans CRUD ──

const PLAN_DEFAULTS: Record<string, { icon: string; color: string; popular: boolean }> = {
  starter:      { icon: 'Zap',   color: 'var(--color-info)',    popular: false },
  professional: { icon: 'Star',  color: 'var(--color-accent)',  popular: true  },
  pro:          { icon: 'Star',  color: 'var(--color-accent)',  popular: true  },
  enterprise:   { icon: 'Crown', color: 'var(--color-primary)', popular: false },
}

export const GET = withSuperAdminRoute(async () => {
  const [rawPlans, rawSubs] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { priceMonthly: 'asc' },
      take: 100,
    }),
    prisma.organizationSubscription.findMany({
      include: {
        organization: { select: { name: true, code: true } },
        plan:         { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const plans = rawPlans.map(p => {
    const defaults = PLAN_DEFAULTS[p.slug] ?? { icon: 'Zap', color: 'var(--color-info)', popular: false }
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      icon: defaults.icon,
      color: defaults.color,
      popular: defaults.popular,
      price: {
        monthly: p.priceMonthly ? Number(p.priceMonthly) : 0,
        annual:  p.priceAnnual  ? Number(p.priceAnnual)  : 0,
      },
      limits: {
        staff:     p.maxStaff,
        trainings: p.maxTrainings,
        storage:   p.maxStorageGb,
      },
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
      hasStaffIntegration: p.hasStaffIntegration,
      organizations: p._count.subscriptions,
    }
  })

  const organizationSubscriptions = rawSubs.map(s => ({
    name:      s.organization.name,
    code:      s.organization.code,
    plan:      s.plan.name,
    status:    s.status,
    expiresAt: s.expiresAt
      ? s.expiresAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-',
    billing:   s.billingCycle === 'monthly' ? 'Aylık' : s.billingCycle === 'annual' ? 'Yıllık' : '-',
  }))

  return jsonResponse({ plans, organizationSubscriptions }, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
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
