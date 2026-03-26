import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { startExamTimer, getExamTimeRemaining, isExamExpired } from '@/lib/redis'

/** Start or get exam timer */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // Search by attempt ID first, then assignmentId
  let attempt = await prisma.examAttempt.findFirst({
    where: { id, userId: dbUser!.id, status: { in: ['pre_exam', 'post_exam'] } },
    include: { training: { select: { examDurationMinutes: true } } },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { assignmentId: id, userId: dbUser!.id, status: { in: ['pre_exam', 'post_exam'] } },
      include: { training: { select: { examDurationMinutes: true } } },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Attempt not found', 404)

  // Check if timer already exists (always use attempt.id as timer key)
  const remaining = await getExamTimeRemaining(attempt.id)
  if (remaining !== null) {
    return jsonResponse({ remainingSeconds: remaining, expired: remaining <= 0 })
  }

  // Start new timer
  const expiresAt = await startExamTimer(attempt.id, attempt.training.examDurationMinutes)

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
        // BUG #5 FIX: Hakkı varsa 'in_progress' olmalı
        const newStatus = att.assignment.currentAttempt >= att.assignment.maxAttempts ? 'failed' : 'in_progress'
        await prisma.trainingAssignment.update({
          where: { id: att.assignmentId },
          data: { status: newStatus },
        })
      }
    }
  }

  return jsonResponse({ remainingSeconds: remaining ?? 0, expired })
}
