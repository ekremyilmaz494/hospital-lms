import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { resolveRequiredPointsBulk } from '@/lib/smg-helpers'
import type { UserRole } from '@/types/database'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const periodId = searchParams.get('periodId')

  const orgId = organizationId

  // Dönem bul: belirtilmişse onu, yoksa aktif dönemi al
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

  if (!period) {
    const staffCount = await prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } })
    return jsonResponse({
      period: null,
      report: [],
      stats: { totalStaff: staffCount, completedCount: 0, completionRate: 0 },
      warning: 'Aktif SMG dönemi tanımlanmamış. Lütfen Ayarlar > SMG bölümünden dönem oluşturun.',
    }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  }

  const [staff, allActivities] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        departmentRel: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    period
      ? prisma.smgActivity.findMany({
          where: {
            organizationId: orgId,
            approvalStatus: 'APPROVED',
            completionDate: {
              gte: period.startDate,
              lte: period.endDate,
            },
          },
          select: { userId: true, smgPoints: true },
        })
      : Promise.resolve([]),
  ])

  // Her personel için puan topla
  const pointsMap = new Map<string, number>()
  for (const a of allActivities) {
    pointsMap.set(a.userId, (pointsMap.get(a.userId) ?? 0) + a.smgPoints)
  }

  const periodFallback = period?.requiredPoints ?? 0

  const requiredMap = period
    ? await resolveRequiredPointsBulk({
        prisma,
        periodId: period.id,
        organizationId: orgId,
        periodFallback,
        users: staff.map(s => ({ id: s.id, title: s.title })),
      })
    : new Map<string, number>()

  const report = staff.map(u => {
    const earned = pointsMap.get(u.id) ?? 0
    const requiredPoints = requiredMap.get(u.id) ?? periodFallback
    return {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      unvan: u.title ?? null,
      department: u.departmentRel?.name ?? '-',
      earnedPoints: earned,
      requiredPoints,
      progress: requiredPoints > 0 ? Math.min(100, Math.round((earned / requiredPoints) * 100)) : 0,
      isCompleted: earned >= requiredPoints && requiredPoints > 0,
    }
  })

  const completedCount = report.filter(r => r.isCompleted).length

  return jsonResponse({
    period,
    report,
    stats: {
      totalStaff: staff.length,
      completedCount,
      completionRate: staff.length > 0 ? Math.round((completedCount / staff.length) * 100) : 0,
    },
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })
