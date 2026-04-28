import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'
import { resolveReportFilters, REPORTS_CACHE_HEADERS } from './_shared'
// Cache-Control: private, max-age=30, stale-while-revalidate=60 (REPORTS_CACHE_HEADERS)

/**
 * Overview-only endpoint — sayfa ilk render'da bunu çağırır.
 * Tab bazlı detay veriler ayrı endpoint'lerde:
 *   - /api/admin/reports/trainings
 *   - /api/admin/reports/staff
 *   - /api/admin/reports/departments
 *   - /api/admin/reports/failure
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const { trainingScope, userDeptFilter, assignmentDateFilter, attemptDateFilter } = resolved.filters

  try {
    const [
      staffCount,
      trainingCount,
      assignmentStatusGroups,
      avgScoreResult,
      availableDepartments,
    ] = await Promise.all([
      prisma.user.count({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true, ...userDeptFilter },
      }),
      prisma.training.count({ where: trainingScope }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { training: trainingScope, user: { ...userDeptFilter }, ...assignmentDateFilter },
        _count: true,
      }),
      prisma.examAttempt.aggregate({
        where: {
          training: trainingScope,
          postExamScore: { not: null },
          user: { ...userDeptFilter },
          ...attemptDateFilter,
        },
        _avg: { postExamScore: true },
      }),
      prisma.department.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ])

    const statusMap = Object.fromEntries(assignmentStatusGroups.map(s => [s.status, s._count]))
    const totalAssignments = assignmentStatusGroups.reduce((sum, s) => sum + s._count, 0)
    const passedCount = statusMap['passed'] ?? 0
    const lockedCount = statusMap['locked'] ?? 0
    const failedCount = (statusMap['failed'] ?? 0) + lockedCount
    const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0
    const completionRate = totalAssignments > 0 ? Math.round((passedCount / totalAssignments) * 100) : 0

    const overviewStats = [
      { title: 'Aktif Eğitim', value: trainingCount, icon: 'GraduationCap', accentColor: 'var(--color-primary)', trend: { value: totalAssignments, label: 'atama', isPositive: true } },
      { title: 'Aktif Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-info)' },
      { title: 'Başarı Oranı', value: `%${completionRate}`, icon: 'Target', accentColor: 'var(--color-success)', trend: { value: passedCount, label: 'başarılı', isPositive: true } },
      { title: 'Ortalama Puan', value: avgScore, icon: 'Award', accentColor: 'var(--color-accent)', trend: { value: failedCount, label: 'başarısız', isPositive: false } },
    ]

    const assignmentStatusBreakdown = {
      total: totalAssignments,
      passed: passedCount,
      failed: statusMap['failed'] ?? 0,
      locked: lockedCount,
      pending: statusMap['pending'] ?? 0,
      in_progress: statusMap['in_progress'] ?? 0,
    }

    return jsonResponse(
      { overviewStats, assignmentStatusBreakdown, availableDepartments },
      200,
      REPORTS_CACHE_HEADERS,
    )
  } catch (err) {
    logger.error('Admin Reports', 'Rapor özeti alınamadı', err)
    return errorResponse('Rapor verileri alınamadı', 503)
  }
}
