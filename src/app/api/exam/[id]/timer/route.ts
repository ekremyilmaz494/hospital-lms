import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { startExamTimer, getExamTimeRemaining, isExamExpired } from '@/lib/redis'

/** Start or get exam timer */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id },
    include: { training: { select: { examDurationMinutes: true } } },
  })

  if (!attempt) return errorResponse('Attempt not found', 404)

  // Check if timer already exists
  const remaining = await getExamTimeRemaining(attemptId)
  if (remaining !== null) {
    return jsonResponse({ remainingSeconds: remaining, expired: remaining <= 0 })
  }

  // Start new timer
  const expiresAt = await startExamTimer(attemptId, attempt.training.examDurationMinutes)

  return jsonResponse({
    remainingSeconds: attempt.training.examDurationMinutes * 60,
    expiresAt,
    expired: false,
  })
}

/** Check timer status */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const remaining = await getExamTimeRemaining(attemptId)
  const expired = await isExamExpired(attemptId)

  // Auto-complete if expired (only if not already completed)
  if (expired) {
    const expiredAttempts = await prisma.examAttempt.findMany({
      where: { id: attemptId, userId: dbUser!.id, status: { in: ['pre_exam', 'post_exam'] } },
      select: { id: true, assignmentId: true, assignment: { select: { currentAttempt: true, maxAttempts: true } } },
    })

    if (expiredAttempts.length > 0) {
      await prisma.examAttempt.updateMany({
        where: { id: { in: expiredAttempts.map(a => a.id) } },
        data: { status: 'completed', postExamCompletedAt: new Date(), isPassed: false },
      })

      // Assignment durumunu guncelle
      for (const att of expiredAttempts) {
        const newStatus = att.assignment.currentAttempt >= att.assignment.maxAttempts ? 'failed' : 'assigned'
        await prisma.trainingAssignment.update({
          where: { id: att.assignmentId },
          data: { status: newStatus },
        })
      }
    }
  }

  return jsonResponse({ remainingSeconds: remaining ?? 0, expired })
}
