import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { resolveRequiredPoints } from '@/lib/smg-helpers'

export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const periodId = searchParams.get('periodId')

  const orgId = organizationId
  const userId = dbUser.id

  // Dönem bul
  let period = null
  if (periodId) {
    period = await prisma.smgPeriod.findFirst({
      where: { id: periodId, organizationId: orgId },
    })
    if (!period) return errorResponse('Dönem bulunamadı', 404)
  } else {
    period = await prisma.smgPeriod.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  const [approvedActivities, pendingActivities, rejectedActivities, allPeriods] = await Promise.all([
    prisma.smgActivity.findMany({
      where: {
        userId,
        organizationId: orgId,
        approvalStatus: 'APPROVED',
        ...(period
          ? { completionDate: { gte: period.startDate, lte: period.endDate } }
          : {}),
      },
      orderBy: { completionDate: 'desc' },
    }),
    prisma.smgActivity.findMany({
      where: {
        userId,
        organizationId: orgId,
        approvalStatus: 'PENDING',
        ...(period
          ? { completionDate: { gte: period.startDate, lte: period.endDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.smgActivity.findMany({
      where: {
        userId,
        organizationId: orgId,
        approvalStatus: 'REJECTED',
        ...(period
          ? { completionDate: { gte: period.startDate, lte: period.endDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        activityType: true,
        completionDate: true,
        smgPoints: true,
        approvalStatus: true,
        provider: true,
        rejectionReason: true,
      },
    }),
    prisma.smgPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, isActive: true },
    }),
  ])

  const approvedPoints = approvedActivities.reduce((sum, a) => sum + a.smgPoints, 0)
  const pendingPoints = pendingActivities.reduce((sum, a) => sum + a.smgPoints, 0)
  const requiredPoints = period
    ? await resolveRequiredPoints({
        prisma,
        periodId: period.id,
        organizationId: orgId,
        userId,
        userTitle: dbUser.title ?? null,
        periodFallback: period.requiredPoints,
      })
    : 0
  const remainingPoints = Math.max(0, requiredPoints - approvedPoints)
  const daysLeft = period
    ? Math.max(0, Math.ceil((period.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return jsonResponse({
    period,
    periods: allPeriods,
    approvedPoints,
    pendingPoints,
    requiredPoints,
    remainingPoints,
    daysLeft,
    progress: requiredPoints > 0 ? Math.min(100, Math.round((approvedPoints / requiredPoints) * 100)) : 0,
    approvedActivities,
    pendingActivities,
    rejectedActivities,
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })
