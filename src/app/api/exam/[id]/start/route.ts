import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'
import { getPendingMandatoryFeedback } from '@/lib/feedback-helpers'

/** Start a new exam attempt or resume existing one */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const { id: assignmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const assignment = await prisma.trainingAssignment.findFirst({
    where: {
      id: assignmentId,
      userId: dbUser!.id,
      training: { organizationId: dbUser!.organizationId! },
    },
    select: {
      id: true,
      trainingId: true,
      status: true,
      currentAttempt: true,
      maxAttempts: true,
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
  if (!assignment.training.isActive || assignment.training.publishStatus === 'archived') {
    return errorResponse('Bu eğitim arşivlenmiş, yeni sınav başlatılamaz.', 403)
  }

  // ── Zorunlu geri bildirim kilidi ──
  // Kullanıcının başka bir eğitim için bekleyen zorunlu feedback'i varsa,
  // aynı eğitime devam/retry hariç yeni başlatmayı engelle.
  const pending = await getPendingMandatoryFeedback(dbUser!.id)
  if (pending && pending.trainingId !== assignment.trainingId) {
    return new Response(
      JSON.stringify({
        error: `"${pending.trainingTitle}" eğitimi için zorunlu geri bildirim bekleniyor. Başka eğitim başlatmadan önce doldurmalısınız.`,
        pendingFeedback: pending,
      }),
      { status: 423, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Egitim tarih araligi kontrolu
  const now = new Date()
  if (now < new Date(assignment.training.startDate)) {
    return errorResponse('Bu eğitim henüz başlanmamış.', 403)
  }
  if (now > new Date(assignment.training.endDate)) {
    return errorResponse('Bu eğitimin süresi dolmuş.', 403)
  }

  if (assignment.status === 'passed') return errorResponse('Zaten başarıyla tamamladınız')
  if (assignment.status === 'locked') return errorResponse('Eğitim kilitlenmiş')
  if (assignment.status === 'failed' && assignment.currentAttempt >= assignment.maxAttempts) {
    return errorResponse('Maksimum deneme sayısına ulaştınız')
  }

  // Mevcut aktif attempt varsa dogrudan don — rate limit gereksiz
  const existing = await prisma.examAttempt.findFirst({
    where: {
      assignmentId,
      userId: dbUser!.id,
      status: { not: 'completed' },
    },
    include: { videoProgress: true },
  })

  if (existing) {
    let resumed = existing
    // Pre_exam'da takılı kalmış attempt'i watching_videos'a yükselt:
    //   - Retry attempt (attemptNumber > 1) AND requirePreExamOnRetry=false → ön sınav atlanır
    //   - Ön sınavı gerçekten tamamlamış attempt (preExamCompletedAt dolu) → status senkron değil, düzelt
    const skipPreExamOnRetry = !assignment.training.requirePreExamOnRetry
    const shouldPromote =
      existing.status === 'pre_exam' &&
      ((existing.attemptNumber > 1 && skipPreExamOnRetry) || existing.preExamCompletedAt !== null)
    if (shouldPromote) {
      resumed = await prisma.examAttempt.update({
        where: { id: existing.id },
        data: {
          status: 'watching_videos',
          preExamCompletedAt: existing.preExamCompletedAt ?? new Date(),
          preExamScore: existing.preExamScore ?? 0,
        },
        include: { videoProgress: true },
      })
    }
    const examOnly = assignment.training.examOnly === true
    return jsonResponse({
      ...resumed,
      examOnly,
      redirectTo: examOnly ? 'post-exam' : undefined,
    })
  }

  // Rate limit SADECE yeni attempt olusturma icin — resume islemleri haric
  const allowed = await checkRateLimit(`exam-start:${dbUser!.id}`, 10, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla sınav başlangıcı. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  // B7.5 — Transaction hatalarını yakala; MAX_ATTEMPTS dışındaki hatalar 500 döndürmesin
  let attempt: Awaited<ReturnType<typeof prisma.examAttempt.findFirst>> | null = null
  const txStartedAt = Date.now()
  try {
  attempt = await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE ile row-level lock — concurrent race condition önlenir
    await tx.$queryRaw`SELECT id FROM training_assignments WHERE id = ${assignmentId}::uuid FOR UPDATE`

    // Double-check inside transaction (lock ile güvenli)
    const existingInTx = await tx.examAttempt.findFirst({
      where: {
        assignmentId,
        userId: dbUser!.id,
        status: { not: 'completed' },
      },
      include: { videoProgress: true },
    })

    if (existingInTx) {
      const skipPreExamOnRetryInTx = !assignment.training.requirePreExamOnRetry
      const shouldPromoteInTx =
        existingInTx.status === 'pre_exam' &&
        ((existingInTx.attemptNumber > 1 && skipPreExamOnRetryInTx) || existingInTx.preExamCompletedAt !== null)
      if (shouldPromoteInTx) {
        return await tx.examAttempt.update({
          where: { id: existingInTx.id },
          data: {
            status: 'watching_videos',
            preExamCompletedAt: existingInTx.preExamCompletedAt ?? new Date(),
            preExamScore: existingInTx.preExamScore ?? 0,
          },
          include: { videoProgress: true },
        })
      }
      return existingInTx
    }

    // Create new attempt
    const newAttemptNumber = assignment.currentAttempt + 1

    // BUG #4 FIX: maxAttempts kontrolü — transaction içinde throw
    if (newAttemptNumber > assignment.maxAttempts) {
      throw new Error('MAX_ATTEMPTS_EXCEEDED')
    }

    // examOnly sınavlarda ön sınav ve video atlanır → doğrudan post_exam
    const isExamOnly = assignment.training.examOnly === true

    if (isExamOnly) {
      const created = await tx.examAttempt.create({
        data: {
          assignmentId,
          userId: dbUser!.id,
          trainingId: assignment.trainingId,
          organizationId: dbUser!.organizationId!,
          attemptNumber: newAttemptNumber,
          status: 'post_exam',
          postExamStartedAt: new Date(),
        },
        include: { videoProgress: true },
      })

      await tx.trainingAssignment.update({
        where: { id: assignmentId },
        data: { currentAttempt: newAttemptNumber, status: 'in_progress' },
      })

      return created
    }

    // Retry'da pre-exam gerekli mi? Training konfigürasyonundan oku.
    // requirePreExamOnRetry=false (varsayılan, mevcut davranışı korur) → retry'da pre-exam atlanır.
    // Admin true yaparsa retry'da da pre-exam yapılır.
    const isRetry = newAttemptNumber > 1
    const skipPreExam = isRetry && !assignment.training.requirePreExamOnRetry
    const initialStatus = skipPreExam ? 'watching_videos' : 'pre_exam'

    const created = await tx.examAttempt.create({
      data: {
        assignmentId,
        userId: dbUser!.id,
        trainingId: assignment.trainingId,
        organizationId: dbUser!.organizationId!,
        attemptNumber: newAttemptNumber,
        status: initialStatus,
        ...(skipPreExam
          ? { preExamCompletedAt: new Date(), preExamScore: 0 }
          : { preExamStartedAt: new Date() }
        ),
      },
      include: { videoProgress: true },
    })

    await tx.trainingAssignment.update({
      where: { id: assignmentId },
      data: { currentAttempt: newAttemptNumber, status: 'in_progress' },
    })

    return created
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
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
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
    logger.warn('Exam Start', `Yavaş başlatma: ${totalElapsed}ms`, { assignmentId, userId: dbUser!.id })
  }

  if (!attempt) return errorResponse('Maksimum deneme sayısına ulaştınız', 403)

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'exam.started',
    entityType: 'exam_attempt',
    entityId: attempt.id,
    newData: { trainingId: assignment.trainingId, attemptNumber: attempt.attemptNumber },
    request,
  })

  void logActivity({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId ?? '',
    action: 'exam_start',
    resourceType: 'exam_attempt',
    resourceId: attempt.id,
    resourceTitle: assignment.training.title,
    metadata: { attemptNumber: attempt.attemptNumber, trainingId: assignment.trainingId },
  })

  const examOnly = assignment.training.examOnly === true
  return jsonResponse({
    ...attempt,
    examOnly,
    redirectTo: examOnly ? 'post-exam' : undefined,
  })
}
