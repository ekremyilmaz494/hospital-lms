import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { startExamTimer, resumeExamTimer, getExamTimeRemaining, isExamExpired } from '@/lib/redis'
import {
  attemptNextStatus,
  attemptStatusToExamPhase,
  assignmentNextStatus,
  type AttemptStatus,
  type AssignmentStatus,
} from '@/lib/exam-state-machine'
import { logger } from '@/lib/logger'

// Süresi dolmuş attempt'i (pre/post) completed+failed yapar ve assignment durumunu günceller.
// Hem GET hem POST recovery yolu bunu çağırır — kullanıcı döndüğünde tutarlı sonlanma.
async function autoCompleteExpiredAttempt(attemptId: string, userId: string) {
  const expired = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId, status: { in: ['pre_exam', 'post_exam'] } },
    select: {
      id: true,
      status: true,
      assignmentId: true,
      assignment: { select: { status: true, currentAttempt: true, maxAttempts: true } },
    },
  })
  if (!expired) return

  // State machine ile doğrula — elle status yazmak yerine TIMEOUT transition'ı.
  // exam-state-machine TEK doğruluk kaynağı; TIMEOUT: pre/post_exam → completed.
  const transition = attemptNextStatus(expired.status as AttemptStatus, { type: 'TIMEOUT' })
  if (!transition.ok) return

  // Assignment durumu da state machine'den türetilir — elle 'failed'/'in_progress'
  // hesaplamak yerine POST_EXAM_FAILED transition'ı. attemptsRemaining eşdeğeri:
  // hak bittiyse 0 (→ failed), kaldıysa kalan deneme sayısı (>0 → in_progress).
  const { currentAttempt, maxAttempts } = expired.assignment
  const attemptsRemaining = currentAttempt >= maxAttempts ? 0 : maxAttempts - currentAttempt
  const assignmentTransition = assignmentNextStatus(
    expired.assignment.status as AssignmentStatus,
    { type: 'POST_EXAM_FAILED', attemptsRemaining },
  )

  // Attempt kapanışı + assignment güncellemesi TEK transaction'da — biri başarılı
  // olup diğeri çökerse tutarsız durum kalmasın (atomiklik).
  await prisma.$transaction(async (tx) => {
    // Atomik guard: yalnız hâlâ pre/post_exam iken kapat — submit ya da başka bir
    // recovery yolu attempt'i bu arada tamamladıysa terminal sonucu ezme.
    const closed = await tx.examAttempt.updateMany({
      where: { id: expired.id, status: { in: ['pre_exam', 'post_exam'] } },
      data: { status: transition.next, postExamCompletedAt: new Date(), isPassed: false },
    })
    if (closed.count === 0) return

    // Assignment beklenmedik biçimde in_progress değilse (ör. zaten terminal) durum
    // güncellemesini atla — attempt kapanışı yine de geçerli kalsın (throw etme).
    if (!assignmentTransition.ok) {
      logger.warn('Exam Timer', 'assignment transition skipped on auto-complete', {
        attemptId: expired.id,
        assignmentId: expired.assignmentId,
        currentAssignmentStatus: expired.assignment.status,
        reason: assignmentTransition.reason,
      })
      return
    }

    await tx.trainingAssignment.update({
      where: { id: expired.assignmentId },
      data: { status: assignmentTransition.next },
    })
  })
}

/** Start or get exam timer */
export const POST = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  // Search by attempt ID first, then assignmentId.
  // organizationId WHERE'de (pre-filter) — post-query 403 kontrolü ikinci katman kalır.
  let attempt = await prisma.examAttempt.findFirst({
    where: { id, userId: dbUser.id, organizationId, status: { in: ['pre_exam', 'post_exam'] } },
    include: { training: { select: { examDurationMinutes: true, organizationId: true } } },
  })
  if (!attempt) {
    // Tek atamaya scope'lu + status filtreli + attemptNumber desc — N1 riski yok
    // (timer attemptId-first çalışır; bu fallback yalnız aynı atama içindedir).
    attempt = await prisma.examAttempt.findFirst({ // perf-check-disable-line
      where: { assignmentId: id, userId: dbUser.id, organizationId, status: { in: ['pre_exam', 'post_exam'] } },
      include: { training: { select: { examDurationMinutes: true, organizationId: true } } },
      orderBy: { attemptNumber: 'desc' },
    })
  }

  if (!attempt) return errorResponse('Attempt not found', 404)

  // Verify org isolation
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  const phase = attemptStatusToExamPhase(attempt.status as AttemptStatus)

  // Son sınav saatinin LAZY başlangıcı — KRİTİK (İZEM CAN incident, 2026-06-03):
  // postExamStartedAt artık video bitiminde DEĞİL, personel son sınava fiilen girdiğinde
  // (bu POST mount'ta çağrılınca) damgalanır. Aksi halde video↔sınav arası gecikme
  // (ara verme, sekme kapatıp dönme) sınav süresini sessizce eritir ve kullanıcı süresi
  // varken otomatik submit'e takılır. Atomik guard (status + postExamStartedAt: null)
  // çift mount / iki sekme race'inde ikinci yazımı eler — ilk POST kazanır, saat bir kez sabitlenir.
  if (phase === 'post' && attempt.postExamStartedAt === null) {
    const now = new Date()
    const stamped = await prisma.examAttempt.updateMany({ // perf-check-disable-line
      where: { id: attempt.id, status: 'post_exam' satisfies AttemptStatus, postExamStartedAt: null },
      data: { postExamStartedAt: now },
    })
    // Yalnız bu istek stamp'i kazandıysa lokal kopyayı güncelle ki aşağıdaki recovery
    // doğru phaseStartedAt ile timer'ı dolaştırsın. Yarışı kaybettiysek DB'den taze oku.
    if (stamped.count > 0) {
      attempt.postExamStartedAt = now
    } else {
      const fresh = await prisma.examAttempt.findUnique({ // perf-check-disable-line
        where: { id: attempt.id },
        select: { postExamStartedAt: true },
      })
      attempt.postExamStartedAt = fresh?.postExamStartedAt ?? now
    }
  }

  // Fast-path: Redis'te canlı sayaç var → olduğu gibi dön
  const remaining = await getExamTimeRemaining(attempt.id)
  if (remaining !== null) {
    return jsonResponse({ remainingSeconds: remaining, expired: remaining <= 0 })
  }

  // Redis TTL geçmiş veya Redis flush. DB'deki phaseStartedAt'tan recovery.
  // Eskiden burası her zaman tam süreli taze timer başlatıyordu → kullanıcı süre
  // dolmuş bile olsa sanki yeni sınava girmiş gibi görüyordu; submit ise 5 dk grace'le reddediyordu.
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

  // Ownership + org isolation check before Redis query — organizationId WHERE'de
  // (pre-filter); aşağıdaki kontrol ikinci katman.
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser.id, organizationId },
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

  // Auto-complete if expired (only if not already completed).
  // POST recovery yoluyla AYNI autoCompleteExpiredAttempt — TIMEOUT state
  // machine transition'ı + atomik guard + assignment durumu tek yerde.
  if (expired) {
    try {
      await autoCompleteExpiredAttempt(attemptId, dbUser.id)
    } catch (err) {
      logger.error('Exam Timer', 'auto-complete failed on GET', { attemptId, err: (err as Error).message })
    }
  }

  // Canlı sayaç — cache yasak; stale değer kullanıcıya yanlış kalan süreyi gösterir.
  return jsonResponse({ remainingSeconds: remaining ?? 0, expired }, 200, {
    'Cache-Control': 'private, no-store',
  })
}, { requireOrganization: true })
