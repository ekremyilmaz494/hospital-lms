import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'
import { resolveReportFilters, REPORTS_CACHE_HEADERS, STAFF_CAP } from '../_shared'
// Cache-Control: private, max-age=30, stale-while-revalidate=60 (REPORTS_CACHE_HEADERS)

/**
 * Personel performans raporu — staffPerformance.
 * "Personel" tab'ı için kullanılır.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const { userDeptFilter, assignmentDateFilter } = resolved.filters

  try {
    const [staff, totalStaffForCap] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, ...userDeptFilter },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
          departmentId: true,
          departmentRel: { select: { id: true, name: true, color: true } },
          assignments: {
            where: { ...assignmentDateFilter, training: { isActive: true, publishStatus: { not: 'archived' } } },
            select: {
              id: true,
              status: true,
              examAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
                select: { postExamScore: true, isPassed: true, status: true, attemptNumber: true },
              },
            },
          },
        },
        take: STAFF_CAP,
      }),
      prisma.user.count({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, ...userDeptFilter },
      }),
    ])

    const STAR_MIN = 80
    const NORMAL_MIN = 50

    const staffPerformance = staff.map(s => {
      const completed = s.assignments.filter(a => a.status === 'passed').length
      const scores = s.assignments
        .map(a => a.examAttempts[0]?.postExamScore)
        .filter(sc => sc != null)
        .map(Number)
      const hasScores = scores.length > 0
      const avg = hasScores ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      let statusKey: 'star' | 'normal' | 'risk' | 'new'
      if (!hasScores) statusKey = 'new'
      else if (avg >= STAR_MIN) statusKey = 'star'
      else if (avg >= NORMAL_MIN) statusKey = 'normal'
      else statusKey = 'risk'
      return {
        name: `${s.firstName} ${s.lastName}`,
        dept: s.departmentRel?.name ?? '',
        completed,
        avgScore: avg,
        status: statusKey,
        color: statusKey === 'star' ? 'var(--color-success)' : statusKey === 'risk' ? 'var(--color-error)' : 'var(--color-info)',
      }
    })

    const truncated = totalStaffForCap > STAFF_CAP
      ? { shown: staff.length, total: totalStaffForCap }
      : null

    return jsonResponse(
      { staffPerformance, truncated },
      200,
      REPORTS_CACHE_HEADERS,
    )
  } catch (err) {
    logger.error('Admin Reports/staff', 'Personel raporu alınamadı', err)
    return errorResponse('Personel raporu alınamadı', 503)
  }
}
