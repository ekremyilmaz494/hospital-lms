import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

export const GET = withSuperAdminRoute(async () => {
  const [
    organizationCount,
    userCount,
    trainingCount,
    activeSubscriptions,
    recentOrganizations,
    monthlyGrowth,
  ] = await Promise.all([
    // Demo org'lar raporlara dahil değil (gerçek müşteri metrikleri).
    prisma.organization.count({ where: { isDemo: false } }),
    prisma.user.count({ where: { organization: { isDemo: false } } }),
    prisma.training.count({ where: { isActive: true, publishStatus: { not: 'archived' }, organization: { isDemo: false } } }),
    prisma.organizationSubscription.count({ where: { status: 'active', organization: { isDemo: false } } }),
    prisma.organization.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { users: true } } },
    }),
    // Monthly organization registrations (last 12 months)
    prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(created_at, 'YYYY-MM') as month, count(*)::bigint as count
      FROM organizations
      WHERE created_at > now() - interval '12 months' AND is_demo = false
      GROUP BY month
      ORDER BY month
    `,
  ])

  return jsonResponse({
    stats: { organizationCount, userCount, trainingCount, activeSubscriptions },
    recentOrganizations,
    monthlyGrowth: monthlyGrowth.map(r => ({ month: r.month, count: Number(r.count) })),
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
})
