import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

/**
 * G7.6 — Returns all exam attempts currently in-progress for this organization.
 * Statuses 'pre_exam', 'watching_videos', 'post_exam' are considered in-progress.
 * Used for initial REST load; subsequent updates come via Supabase Realtime.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const organizationId = dbUser!.organizationId
  if (!organizationId) return jsonResponse({ attempts: [] })

  const IN_PROGRESS_STATUSES = ['pre_exam', 'watching_videos', 'post_exam']

  const attempts = await prisma.examAttempt.findMany({
    where: {
      status: { in: IN_PROGRESS_STATUSES },
      assignment: { user: { organizationId } },
    },
    select: {
      id: true,
      status: true,
      attemptNumber: true,
      preExamStartedAt: true,
      createdAt: true,
      assignment: {
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true, departmentId: true },
          },
          training: {
            select: { id: true, title: true, examDurationMinutes: true },
          },
          maxAttempts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return jsonResponse({
    attempts: attempts.map(a => ({
      id: a.id,
      status: a.status,
      attemptNumber: a.attemptNumber,
      startedAt: (a.preExamStartedAt ?? a.createdAt).toISOString(),
      user: {
        id: a.assignment.user.id,
        name: `${a.assignment.user.firstName} ${a.assignment.user.lastName}`,
        department: a.assignment.user.departmentId ?? null,
      },
      training: {
        id: a.assignment.training.id,
        title: a.assignment.training.title,
        examDurationMinutes: a.assignment.training.examDurationMinutes,
      },
      maxAttempts: a.assignment.maxAttempts,
    })),
  })
}
