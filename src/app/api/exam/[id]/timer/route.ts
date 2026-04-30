import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { startExamTimer, resumeExamTimer, getExamTimeRemaining, isExamExpired } from '@/lib/redis'
import { attemptStatusToExamPhase, type AttemptStatus } from '@/lib/exam-state-machine'
import { logger } from '@/lib/logger'

// Süresi dolmuş attempt'i (pre/post) completed+failed yapar ve assignment durumunu günceller.
// Hem GET hem POST recovery yolu bunu çağırır — kullanıcı döndüğünde tutarlı sonlanma.
async function autoCompleteExpiredAttempt(attemptId: string, userId: string) {
  const expired = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId, status: { in: ['pre_exam', 'post_exam'] } },
    select: { id: true, assignmentId: true, assignment: { select: { currentAttempt: true, maxAttempts: true } } },
  })
  if (!expired) return
  await prisma.examAttempt.update({
    where: { id: expired.id },
    data: { status: 'completed', postExamCompletedAt: new Date(), isPassed: false },
  })
  const newStatus = expired.assignment.currentAttempt >= expired.assignment.maxAttempts ? 'failed' : 'in_progress'
  await prisma.trainingAssignment.update({
    where: { id: expired.assignmentId },
    data: { status: newStatus },
  })
}

/** Start or get exam timer */
export const POST = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  // Search by attempt ID first, then assignmentId
  let attempt = await prisma.examAttempt.findFirst({
    where: { id, userId: dbUser.id, status: { in: ['pre_exam', 'post_exam'] } },
    include: { training: { select: { examDurationMinutes: true, organizationId: true } } },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { assignmentId: id, userId: dbUser.id, status: { in: ['pre_exam', 'post_exam'] } },
      include: { training: { select: { examDurationMinutes: true, organizationId: true } } },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Attempt not found', 404)

  // Verify org isolation
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  // Fast-path: Redis'te canlı sayaç var → olduğu gibi dön
  const remaining = await getExamTimeRemaining(attempt.id)
  if (remaining !== null) {
    return jsonResponse({ remainingSeconds: remaining, expired: remaining <= 0 })
  }

  // Redis TTL geçmiş veya Redis flush. DB'deki phaseStartedAt'tan recovery.
  // Eskiden burası her zaman tam süreli taze timer başlatıyordu → kullanıcı süre
  // dolmuş bile olsa sanki yeni sınava girmiş gibi görüyordu; submit ise 5 dk grace'le reddediyordu.
  const phase = attemptStatusToExamPhase(attempt.status as AttemptStatus)
  const phaseStartedAt = phase === 'pre' ? attempt.preExamStartedAt : phase === 'post' ? attempt.postExamStartedAt : null

  if (phaseStartedAt && attempt.training.examDurationMinutes) {
    const expiresAt = new Date(phaseStartedAt).getTime() + attempt.training.examDurationMinutes * 60 * 1000
    const remainingMs = expiresAt - Date.now()

    if (remainingMs <= 0) {
      // Süre gerçekten dolmuş → attempt'i kapat, kullanıcıya expired dön (sayfa yönlendirir)
      try {
        await autoCompleteExpiredAttempt(attempt.id, dbUser.id)
      } catch (err) {
        logger.error('Exam Timer', 'auto-complete failed on POST recovery', { attemptId: attempt.id, err: (err as Error).message })
      }
      return jsonResponse({ remainingSeconds: 0, expired: true })
    }

    // Hâlâ süre var → Redis'i DB'ye göre doğru expiresAt ile doldur, kalanı dön
    await resumeExamTimer(attempt.id, expiresAt)
    return jsonResponse({ remainingSeconds: Math.ceil(remainingMs / 1000), expiresAt, expired: false })
  }

  // İlk kez (phaseStartedAt yok) — taze timer başlat
  const expiresAt = await startExamTimer(attempt.id, attempt.training.examDurationMinutes)

  return jsonResponse({
    remainingSeconds: attempt.training.examDurationMinutes * 60,
    expiresAt,
    expired: false,
  })
}, { requireOrganization: true })

/** Check timer status */
export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id: attemptId } = params

  // Ownership + org isolation check before Redis query
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser.id },
    include: { training: { select: { organizationId: true, examDurationMinutes: true } } },
  })
  if (!attempt) return errorResponse('Attempt not found', 404)
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  let remaining = await getExamTimeRemaining(attemptId)
  let expired = await isExamExpired(attemptId)

  // Redis kaybolmuş ama attempt hâlâ pre/post_exam'daysa DB'ye düş:
  // aksi halde isExamExpired=false döndüğü için süresi dolmuş attempt auto-complete olmaz.
  if (remaining === null) {
    const phase = attemptStatusToExamPhase(attempt.status as AttemptStatus)
    const phaseStartedAt = phase === 'pre' ? attempt.preExamStartedAt : phase === 'post' ? attempt.postExamStartedAt : null
    if (phaseStartedAt && attempt.training.examDurationMinutes) {
      const remainingMs = new Date(phaseStartedAt).getTime() + attempt.training.examDurationMinutes * 60 * 1000 - Date.now()
      remaining = Math.max(0, Math.ceil(remainingMs / 1000))
      expired = remainingMs <= 0
    }
  }

  // Auto-complete if expired (only if not already completed)
  if (expired) {
    const expiredAttempts = await prisma.examAttempt.findMany({
      where: { id: attemptId, userId: dbUser.id, status: { in: ['pre_exam', 'post_exam'] } },
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

  // Canlı sayaç — cache yasak; stale değer kullanıcıya yanlış kalan süreyi gösterir.
  return jsonResponse({ remainingSeconds: remaining ?? 0, expired }, 200, {
    'Cache-Control': 'private, no-store',
  })
}, { requireOrganization: true })
