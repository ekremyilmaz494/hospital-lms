import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

/**
 * GET /api/admin/subscription
 * Hastane admini kendi abonelik durumunu ve faturalarini gorur
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const [subscription, org, staffCount, trainingCount] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      include: {
        plan: true,
        invoices: {
          orderBy: { issuedAt: 'desc' },
          take: 12,
        },
        payments: {
          where: { status: 'paid' },
          orderBy: { paidAt: 'desc' },
          take: 5,
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
    prisma.training.count({ where: { organizationId: orgId } }),
  ])

  if (!subscription) {
    return jsonResponse({
      hasSubscription: false,
      organization: org?.name ?? '',
    }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  }

  const plan = subscription.plan
  const daysLeft = subscription.expiresAt
    ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86400000))
    : null

  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  return jsonResponse({
    hasSubscription: true,
    organization: org?.name ?? '',
    subscription: {
      id: subscription.id,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      trialEndsAt: subscription.trialEndsAt,
      daysLeft,
      trialDaysLeft,
    },
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      maxStaff: plan.maxStaff,
      maxTrainings: plan.maxTrainings,
      maxStorageGb: plan.maxStorageGb,
      priceMonthly: plan.priceMonthly ? Number(plan.priceMonthly) : null,
      priceAnnual: plan.priceAnnual ? Number(plan.priceAnnual) : null,
      features: plan.features,
    },
    usage: {
      staffCount,
      staffLimit: plan.maxStaff,
      staffPercent: plan.maxStaff ? Math.round((staffCount / plan.maxStaff) * 100) : 0,
      trainingCount,
      trainingLimit: plan.maxTrainings,
      trainingPercent: plan.maxTrainings ? Math.round((trainingCount / plan.maxTrainings) * 100) : 0,
    },
    invoices: subscription.invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: Number(inv.amount),
      totalAmount: Number(inv.totalAmount),
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      issuedAt: inv.issuedAt,
    })),
    availablePlans: await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    }),
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}
