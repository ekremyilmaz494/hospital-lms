import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getOrgStorageBytes } from '@/lib/s3'
import type { UserRole } from '@/types/database'

const BYTES_PER_GB = 1024 * 1024 * 1024

/**
 * GET /api/admin/subscription
 * Hastane admini kendi abonelik durumunu ve faturalarini gorur
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const [subscription, org, staffCount, trainingCount, storageBytes] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { organizationId },
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
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.user.count({ where: { organizationId, role: 'staff' satisfies UserRole } }),
    prisma.training.count({ where: { organizationId } }),
    getOrgStorageBytes(organizationId),
  ])

  const storageUsedGb = Number((storageBytes / BYTES_PER_GB).toFixed(2))

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
      storageUsedGb,
      storageLimit: plan.maxStorageGb,
      storagePercent: plan.maxStorageGb ? Math.round((storageBytes / (plan.maxStorageGb * BYTES_PER_GB)) * 100) : 0,
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
    // Ödeme yöntemi geçmişi (son 5 başarılı ödeme) — kart markası/son 4 hane
    payments: subscription.payments.map(p => ({
      id: p.id,
      paidAt: p.paidAt,
      amount: Number(p.amount),
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      cardBrand: p.cardBrand,
      cardLastFour: p.cardLastFour,
    })),
    availablePlans: await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    }),
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })
