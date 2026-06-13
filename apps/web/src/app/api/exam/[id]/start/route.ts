import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'
import { getPendingMandatoryFeedback } from '@/lib/feedback-helpers'
import { isTrainingAccessible } from '@/lib/training-helpers'
import { advancePastVideosIfNoneRequired } from '@/lib/exam-helpers'
import { resolveExamFlowState } from '@/lib/exam-flow-resolver'
import { isEndDatePassed } from '@/lib/date-helpers'
import {
  attemptNextStatus,
  assignmentNextStatus,
  type AttemptStatus,
  type AssignmentStatus,
} from '@/lib/exam-state-machine'

/** Start a new exam attempt or resume existing one */
export const POST = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const startedAt = Date.now()
  const { id: assignmentId } = params

  const assignment = await prisma.trainingAssignment.findFirst({
    where: {
      id: assignmentId,
      userId: dbUser.id,
      training: { organizationId },
    },
    select: {
      id: true,
      trainingId: true,
      status: true,
      currentAttempt: true,
      maxAttempts: true,
      dueDate: true,
      training: {
        select: {
          startDate: true,
          endDate: true,
          examOnly: true,
          requirePreExamOnRetry: true,
          title: true,
          isActive: true,
          publishStatus: true,
        },
      },
    },
  })

  if (!assignment) return errorResponse('Eğitim atanması bulunamadı', 404)

  // Arşivli eğitim: yeni sınav başlatılamaz (in-progress attempt'ler resume'a izin verilir)
  if (!isTrainingAccessible(assignment.training)) {
    return errorResponse('Bu eğitim arşivlenmiş, yeni sınav başlatılamaz.', 403)
  }

  // Per-atama dueDate (2. tur override) varsa training.endDate yerine onu kullan.
  // Bu sayede admin "Yeniden Ata"da yeni bitiş verince, ana training.endDate
  // geçmiş olsa bile yeni round'daki personel sınava girebilir.
  const effectiveDueDate = assignment.dueDate ?? assignment.training.endDate

  // ── Zorunlu geri bildirim kilidi ──
  // Kullanıcının başka bir eğitim için bekleyen zorunlu feedback'i varsa,
  // aynı eğitime devam/retry hariç yeni başlatmayı engelle.
  const pending = await getPendingMandatoryFeedback(dbUser.id)
  if (pending && pending.trainingId !== assignment.trainingId) {
    return new Response(
      JSON.stringify({
        error: `"${pending.trainingTitle}" eğitimi için zorunlu geri bildirim bekleniyor. Başka eğitim başlatmadan önce doldurmalısınız.`,
        pendingFeedback: pending,
      }),
      { status: 423, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Egitim tarih araligi kontrolu — endDate'i gün sonu olarak yorumla (eski kayıtlarda
  // 00:00:00 olarak saklanmış olabilir; "16 Mayıs son" girilen eğitim o günün sonuna
  // kadar açık kalsın).
  const now = new Date()
  if (now < new Date(assignment.training.startDate)) {
    return errorResponse('Bu eğitim henüz başlanmamış.', 403)
  }
  if (isEndDatePassed(effectiveDueDate, now)) {
    return errorResponse('Bu eğitimin süresi dolmuş.', 403)
  }

  if (assignment.status === 'passed') return errorResponse('Zaten başarıyla tamamladınız')
  if (assignment.status === 'locked') return errorResponse('Eğitim kilitlenmiş')
  if (assignment.status === 'failed' && assignment.currentAttempt >= assignment.maxAttempts) {
    return errorResponse('Maksimum deneme sayısına ulaştınız')
  }

  // TEK KARAR YOLU: resume/promote mantığı YALNIZ transaction içinde yaşar.
  // Eskiden aynı blok hem burada (hızlı yol) hem tx içinde kopyalanmıştı; iki
  // kopyanın filtreleri ayrıştığında sonsuz redirect döngüsü doğmuştu
  // (2026-05-20 Devakent, commit 2fa15b1). Dışarıda sadece "rate limit gerekli
  // mi?" okuması kalır — resolver aktif attempt görüyorsa resume olacağı için
  // rate limit atlanır (resume rate limit'e takılmamalı).
  const preState = await resolveExamFlowState(assignmentId, dbUser.id, organizationId)

  if (!preState.activeAttempt) {
    // Rate limit SADECE yeni attempt olusturma icin — resume islemleri haric
    const allowed = await checkRateLimit(`exam-start:${dbUser.id}`, 10, 3600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Çok fazla sınav başlangıcı. Lütfen 60 dakika sonra tekrar deneyin.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
      })
    }
  }

  // B7.5 — Transaction hatalarını yakala; MAX_ATTEMPTS dışındaki hatalar 500 döndürmesin
  type AttemptRecord = NonNullable<Awaited<ReturnType<typeof prisma.examAttempt.findFirst>>>
  let txResult: { record: AttemptRecord; created: boolean } | null = null
  const txStartedAt = Date.now()
  try {
  txResult = await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE ile row-level lock — concurrent race condition önlenir
    await tx.$queryRaw`SELECT id FROM training_assignments WHERE id = ${assignmentId}::uuid FOR UPDATE`

    // Double-check inside transaction (lock ile güvenli). Filter outer check
    // (line ~98) ile AYNI olmalı: 'expired' attempt'i resume etme — cron
    // expire ettiyse yeni attempt açılır. Aksi halde frontend
    // `attemptStatus='expired'` görüp `attemptPhaseRedirect` ile detay sayfasına
    // atılır, kullanıcı "Videoları İzle"ye basıp tekrar buraya gelir → sonsuz
    // döngü (2026-05-20 Devakent ÖZGÜR ÜNVER incident; PR #165 sonrası
    // detay-sayfası redirect'i doğru ama bu transaction bug'ı tetikliyordu).
    const existingInTx = await tx.examAttempt.findFirst({
      where: {
        assignmentId,
        userId: dbUser.id,
        status: { notIn: ['completed', 'expired'] },
      },
      include: { videoProgress: true },
    })

    if (existingInTx) {
      // Promote kararı state machine dışında kalır (iş mantığı koşulu).
      const skipPreExamOnRetryInTx = !assignment.training.requirePreExamOnRetry
      const shouldPromoteInTx =
        existingInTx.status === 'pre_exam' &&
        ((existingInTx.attemptNumber > 1 && skipPreExamOnRetryInTx) || existingInTx.preExamCompletedAt !== null)
      if (shouldPromoteInTx) {
        // Self-heal sinyali: preExamCompletedAt dolu ama status hâlâ pre_exam.
        // submit route'un CAS'li transaction'ı bu ikisini ATOMİK yazar — bu warn
        // görünüyorsa başka bir kod yolu senkronu bozuyor demektir. Promote
        // kullanıcıyı kurtarır ama altta yatan bug'ı MASKELEMESİN diye loglanır.
        if (existingInTx.preExamCompletedAt !== null) {
          logger.warn('Exam Start', 'Self-heal promote: preExamCompletedAt dolu ama status pre_exam', {
            assignmentId,
            attemptId: existingInTx.id,
            userId: dbUser.id,
            attemptNumber: existingInTx.attemptNumber,
          })
        }
        const transitionInTx = attemptNextStatus(existingInTx.status as AttemptStatus, { type: 'PRE_EXAM_SUBMITTED' })
        if (!transitionInTx.ok) {
          throw new Error(`PROMOTE_TRANSITION_REJECTED: ${transitionInTx.reason}`)
        }
        const promoted = await tx.examAttempt.update({
          where: { id: existingInTx.id },
          data: {
            status: transitionInTx.next,
            preExamCompletedAt: existingInTx.preExamCompletedAt ?? new Date(),
            preExamScore: existingInTx.preExamScore ?? 0,
          },
          include: { videoProgress: true },
        })
        return { record: promoted, created: false }
      }
      return { record: existingInTx, created: false }
    }

    // Create new attempt
    const newAttemptNumber = assignment.currentAttempt + 1

    // BUG #4 FIX: maxAttempts kontrolü — transaction içinde throw
    if (newAttemptNumber > assignment.maxAttempts) {
      throw new Error('MAX_ATTEMPTS_EXCEEDED')
    }

    // Yeni attempt için initial status'ü state machine belirler:
    //   - examOnly=true → post_exam (ön sınav + video atlanır)
    //   - isRetry + !requirePreExamOnRetry → watching_videos (retry'da pre-exam atlanır)
    //   - Aksi halde → pre_exam
    // requirePreExamOnRetry gerçek davranışı training schema field'ından gelir.
    const isExamOnly = assignment.training.examOnly === true
    const isRetry = newAttemptNumber > 1
    const requirePreExamOnRetry = assignment.training.requirePreExamOnRetry === true

    const startTransition = attemptNextStatus(null, {
      type: 'START',
      examOnly: isExamOnly,
      isRetry,
      requirePreExamOnRetry,
    })
    if (!startTransition.ok) {
      throw new Error(`START_TRANSITION_REJECTED: ${startTransition.reason}`)
    }
    const initialStatus = startTransition.next

    // Timestamp alanları initialStatus'e göre seçilir (state ↔ data tutarlılığı).
    const timestampFields =
      initialStatus === 'post_exam'
        ? { postExamStartedAt: new Date() }
        : initialStatus === 'watching_videos'
          ? { preExamCompletedAt: new Date(), preExamScore: 0 }
          : { preExamStartedAt: new Date() }

    const createdAttempt = await tx.examAttempt.create({
      data: {
        assignmentId,
        userId: dbUser.id,
        trainingId: assignment.trainingId,
        organizationId,
        attemptNumber: newAttemptNumber,
        status: initialStatus,
        ...timestampFields,
      },
      include: { videoProgress: true },
    })

    // Assignment status geçişi de state machine üzerinden gider.
    const assignmentTransition = assignmentNextStatus(assignment.status as AssignmentStatus, { type: 'ATTEMPT_STARTED' })
    if (!assignmentTransition.ok) {
      throw new Error(`ASSIGNMENT_TRANSITION_REJECTED: ${assignmentTransition.reason}`)
    }

    await tx.trainingAssignment.update({
      where: { id: assignmentId },
      data: { currentAttempt: newAttemptNumber, status: assignmentTransition.next },
    })

    return { record: createdAttempt, created: true }
  }, { timeout: 10_000, maxWait: 5_000 }).catch((err: Error) => {
    if (err.message === 'MAX_ATTEMPTS_EXCEEDED') return null
    throw err // re-throw to outer try-catch
  })
  } catch (err) {
    const txElapsed = Date.now() - txStartedAt
    const totalElapsed = Date.now() - startedAt
    const errName = err instanceof Error ? err.name : 'Unknown'
    const errMsg = err instanceof Error ? err.message : String(err)
    // Prisma known error codes (P2024=pool timeout, P2028=tx timeout, P2034=deadlock)
    const prismaCode = (err as { code?: string } | null)?.code
    logger.error('Exam Start', 'Sınav başlatma hatası', {
      assignmentId,
      userId: dbUser.id,
      organizationId,
      errName,
      errMsg,
      prismaCode,
      txElapsedMs: txElapsed,
      totalElapsedMs: totalElapsed,
    })
    return errorResponse('Sınav başlatılamadı. Lütfen tekrar deneyin.', 500)
  }

  const totalElapsed = Date.now() - startedAt
  if (totalElapsed > 2000) {
    logger.warn('Exam Start', `Yavaş başlatma: ${totalElapsed}ms`, { assignmentId, userId: dbUser.id })
  }

  if (!txResult) return errorResponse('Maksimum deneme sayısına ulaştınız', 403)
  let attempt = txResult.record

  // Videosuz/PDF-only eğitim: watching_videos'da takılı kalmasın. TEK çağrı
  // noktası — eskiden resume hızlı yolu + bu blok olmak üzere iki yerden
  // çağrılıyordu (drift kaynağı). `noRequiredVideos` yanıtla döner; transition
  // page kullanıcıya AÇIK mesaj gösterir, video aşaması sessizce atlanmaz.
  let videosAutoSkipped = false
  if (attempt.status === 'watching_videos') {
    const advance = await advancePastVideosIfNoneRequired(attempt.id, attempt.trainingId)
    if (advance.advanced) {
      attempt = { ...attempt, status: 'post_exam', postExamStartedAt: new Date() }
      videosAutoSkipped = true
    }
  }

  // Audit yalnız GERÇEK yeni denemede — her resume POST'unda 'exam.started'
  // yazmak audit'i gürültüye boğar (videos/pre-exam/post-exam sayfaları mount'ta
  // start çağırır).
  if (txResult.created) {
    await audit({
      action: 'exam.started',
      entityType: 'exam_attempt',
      entityId: attempt.id,
      newData: { trainingId: assignment.trainingId, attemptNumber: attempt.attemptNumber },
    })

    void logActivity({
      userId: dbUser.id,
      organizationId,
      action: 'exam_start',
      resourceType: 'exam_attempt',
      resourceId: attempt.id,
      resourceTitle: assignment.training.title,
      metadata: { attemptNumber: attempt.attemptNumber, trainingId: assignment.trainingId },
    })
  }

  const examOnly = assignment.training.examOnly === true
  const redirectTo = attempt.status === 'post_exam' ? 'post-exam' : undefined
  return jsonResponse({
    ...attempt,
    examOnly,
    redirectTo,
    // Additive alanlar — mevcut client'lar görmezden gelir.
    stage: attempt.status,
    noRequiredVideos: videosAutoSkipped,
  })
}, { requireOrganization: true })
