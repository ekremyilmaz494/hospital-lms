import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'

/**
 * Get an active exam attempt and verify the user is in the required phase.
 * Returns the attempt or an error response.
 */
export async function getAttemptWithPhaseCheck(
  id: string,
  userId: string,
  requiredPhase: string | string[],
  userOrgId: string,
) {
  // Tenant isolation: training.organizationId mutlaka çağıranın org'u olmalı (cross-org leak önlemi)
  const orgGuard = { training: { organizationId: userOrgId } }

  let attempt = await prisma.examAttempt.findFirst({
    where: { assignmentId: id, userId, status: { not: 'completed' }, ...orgGuard },
    include: {
      training: { select: { id: true, passingScore: true, examDurationMinutes: true } },
      videoProgress: true,
    },
    orderBy: { attemptNumber: 'desc' },
  })

  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { trainingId: id, userId, status: { not: 'completed' }, ...orgGuard },
      include: {
        training: { select: { id: true, passingScore: true, examDurationMinutes: true } },
        videoProgress: true,
      },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) {
    return { attempt: null, error: errorResponse('Aktif sınav denemesi bulunamadı', 404) }
  }

  const phases = Array.isArray(requiredPhase) ? requiredPhase : [requiredPhase]

  if (!phases.includes(attempt.status)) {
    // Return correct redirect info
    const redirectMap: Record<string, string> = {
      pre_exam: 'pre-exam',
      watching_videos: 'videos',
      post_exam: 'post-exam',
    }
    const redirect = redirectMap[attempt.status] || 'pre-exam'

    return {
      attempt: null,
      error: errorResponse(
        JSON.stringify({ message: 'Bu işlem şu anki aşamada yapılamaz', currentPhase: attempt.status, redirect }),
        403,
      ),
    }
  }

  return { attempt, error: null }
}

/**
 * Get attempt status for frontend phase guard (read-only, no phase restriction)
 * Searches by assignmentId first, then by trainingId as fallback
 */
export async function getAttemptStatus(id: string, userId: string, userOrgId: string) {
  const orgGuard = { training: { organizationId: userOrgId } }

  let attempt = await prisma.examAttempt.findFirst({
    where: { assignmentId: id, userId, ...orgGuard },
    orderBy: { attemptNumber: 'desc' },
    select: { id: true, status: true, preExamCompletedAt: true, videosCompletedAt: true, postExamCompletedAt: true },
  })

  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { trainingId: id, userId, ...orgGuard },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true, status: true, preExamCompletedAt: true, videosCompletedAt: true, postExamCompletedAt: true },
    })
  }

  return attempt
}
