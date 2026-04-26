import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const [
    hospitalCount,
    userCount,
    trainingCount,
    activeSubscriptions,
    recentHospitals,
    monthlyGrowth,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.training.count({ where: { isActive: true, publishStatus: { not: 'archived' } } }),
    prisma.organizationSubscription.count({ where: { status: 'active' } }),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { users: true } } },
    }),
    // Monthly hospital registrations (last 12 months)
    prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(created_at, 'YYYY-MM') as month, count(*)::bigint as count
      FROM organizations
      WHERE created_at > now() - interval '12 months'
      GROUP BY month
      ORDER BY month
    `,
  ])

  return jsonResponse({
    stats: { hospitalCount, userCount, trainingCount, activeSubscriptions },
    recentHospitals,
    monthlyGrowth: monthlyGrowth.map(r => ({ month: r.month, count: Number(r.count) })),
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}
