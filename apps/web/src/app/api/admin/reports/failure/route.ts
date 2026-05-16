import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'
import { resolveReportFilters, REPORTS_CACHE_HEADERS, STAFF_CAP } from '../_shared'
// Cache-Control: private, max-age=30, stale-while-revalidate=60 (REPORTS_CACHE_HEADERS)

/**
 * Başarısızlık + süre raporu — failureData, durationData.
 * "Başarısızlık" tab'ı için kullanılır.
 *
 * failureData: status='failed' | 'locked' atamaları doğrudan SQL filtresiyle çek;
 * personel array'i üzerinden flatMap+filter zinciri yapma.
 */
export const GET = withAdminRoute(async ({ request, organizationId: orgId }) => {
  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const { trainingScope, userDeptFilter, assignmentDateFilter } = resolved.filters

  try {
    const failedAssignments = await prisma.trainingAssignment.findMany({
      where: {
        status: { in: ['failed', 'locked'] },
        training: trainingScope,
        user: {
          organizationId: orgId,
          role: 'staff' satisfies UserRole,
          ...userDeptFilter,
        },
        ...assignmentDateFilter,
      },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
        training: { select: { title: true, maxAttempts: true } },
        examAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: { postExamScore: true, attemptNumber: true },
        },
      },
      take: STAFF_CAP,
      orderBy: { assignedAt: 'desc' },
    })

    const failureData = failedAssignments.map(a => {
      const lastAttempt = a.examAttempts[0]
      const attemptsUsed = lastAttempt?.attemptNumber ?? 0
      const maxAttempts = a.training?.maxAttempts ?? 3
      const lastScore = lastAttempt?.postExamScore ? Number(lastAttempt.postExamScore) : 0
      return {
        assignmentId: a.id,
        name: `${a.user.firstName} ${a.user.lastName}`,
        dept: a.user.departmentRel?.name ?? '',
        training: a.training?.title ?? '',
        attempts: attemptsUsed,
        maxAttempts,
        lastScore,
        status: attemptsUsed >= maxAttempts ? 'locked' : 'failed',
      }
    })

    return jsonResponse(
      { failureData },
      200,
      REPORTS_CACHE_HEADERS,
    )
  } catch (err) {
    logger.error('Admin Reports/failure', 'Başarısızlık raporu alınamadı', err)
    return errorResponse('Başarısızlık raporu alınamadı', 503)
  }
}, { requireOrganization: true })
