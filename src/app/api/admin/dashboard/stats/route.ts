import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'

const CACHE_TTL = 120 // 2 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const cacheKey = `dashboard:stats:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    // Archived/inactive training'ler "yok hükmünde" — istatistik sayımlarında dışarı al
    const trainingScope = { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } }

    const [
      staffCount,
      activeStaffCount,
      trainingCount,
      activeTrainingCount,
      statusCounts,
      compulsoryTrainings,
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole } }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } }),
      prisma.training.count({ where: { organizationId: orgId, publishStatus: { not: 'archived' } } }),
      prisma.training.count({ where: trainingScope }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { training: trainingScope },
        _count: true,
      }),
      prisma.training.findMany({
        where: { ...trainingScope, isCompulsory: true },
        select: { id: true, title: true, complianceDeadline: true, regulatoryBody: true, assignments: { select: { status: true } } },
      }),
    ])

    const now = new Date()

    // Status aggregation
    const statusMap = new Map(statusCounts.map(s => [s.status, s._count]))
    const completedCount = statusMap.get('passed') ?? 0
    const failedCount = statusMap.get('failed') ?? 0
    const inProgressCount = statusMap.get('in_progress') ?? 0
    const totalAssignments = statusCounts.reduce((sum, s) => sum + s._count, 0)
    const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

    // Compliance
    const compulsoryAssignments = compulsoryTrainings.flatMap(t => t.assignments)
    const compulsoryCompleted = compulsoryAssignments.filter(a => a.status === 'passed').length
    const complianceRate = compulsoryAssignments.length > 0
      ? Math.round((compulsoryCompleted / compulsoryAssignments.length) * 100)
      : 100

    // Compliance alerts
    const complianceAlerts = compulsoryTrainings
      .filter(t => t.complianceDeadline && new Date(t.complianceDeadline) > now)
      .map(t => {
        const daysLeft = Math.ceil((new Date(t.complianceDeadline!).getTime() - now.getTime()) / 86400000)
        const totalAssigned = t.assignments.length
        const passed = t.assignments.filter((a: { status: string }) => a.status === 'passed').length
        return {
          training: t.title,
          regulatoryBody: t.regulatoryBody ?? '',
          daysLeft,
          complianceRate: totalAssigned > 0 ? Math.round((passed / totalAssigned) * 100) : 0,
          status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5)

    // Status distribution for donut chart
    const statusDistribution = [
      { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
      { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
      { name: 'Basarisiz', value: failedCount, color: 'var(--color-error)' },
      { name: 'Bekleyen', value: totalAssignments - completedCount - inProgressCount - failedCount, color: 'var(--color-warning)' },
    ]

    const responseData = {
      stats: [
        { title: 'Toplam Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-primary)', trend: { value: activeStaffCount, label: 'aktif', isPositive: true } },
        { title: 'Aktif Egitim', value: activeTrainingCount, icon: 'GraduationCap', accentColor: 'var(--color-info)', trend: { value: trainingCount, label: 'toplam', isPositive: true } },
        { title: 'Tamamlanma Orani', value: `%${completionRate}`, icon: 'TrendingUp', accentColor: 'var(--color-success)', trend: { value: completedCount, label: 'tamamlanan', isPositive: true } },
        { title: 'Geciken Egitim', value: failedCount, icon: 'AlertTriangle', accentColor: 'var(--color-error)', trend: { value: failedCount, label: 'basarisiz', isPositive: false } },
        { title: 'Uyum Orani', value: `%${complianceRate}`, icon: 'ShieldCheck', accentColor: complianceRate >= 80 ? 'var(--color-success)' : complianceRate >= 60 ? 'var(--color-warning)' : 'var(--color-error)', trend: { value: compulsoryTrainings.length, label: 'zorunlu egitim', isPositive: complianceRate >= 80 } },
      ],
      complianceAlerts,
      statusDistribution,
    }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Stats', 'Stats verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Stats verileri alinamadi', 503)
  }
}
