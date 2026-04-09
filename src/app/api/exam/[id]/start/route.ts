import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/** Start a new exam attempt or resume existing one */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    include: { training: true },
  })

  if (!assignment) return errorResponse('Assignment not found', 404)

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
    const examOnly = assignment.training.examOnly === true
    return jsonResponse({
      ...existing,
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
  try {
  attempt = await prisma.$transaction(async (tx) => {
    // Double-check inside transaction (prevent race condition between check above and create)
    const existingInTx = await tx.examAttempt.findFirst({
      where: {
        assignmentId,
        userId: dbUser!.id,
        status: { not: 'completed' },
      },
      include: { videoProgress: true },
    })

    if (existingInTx) return existingInTx

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

    // 2. ve sonraki denemelerde ön sınav atlanır → doğrudan watching_videos
    const isRetry = newAttemptNumber > 1
    const initialStatus = isRetry ? 'watching_videos' : 'pre_exam'

    const created = await tx.examAttempt.create({
      data: {
        assignmentId,
        userId: dbUser!.id,
        trainingId: assignment.trainingId,
        attemptNumber: newAttemptNumber,
        status: initialStatus,
        ...(isRetry
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
  }).catch((err: Error) => {
    if (err.message === 'MAX_ATTEMPTS_EXCEEDED') return null
    throw err // re-throw to outer try-catch
  })
  } catch (err) {
    logger.error('Exam Start', 'Sınav başlatma hatası', err)
    return errorResponse('Sınav başlatılamadı. Lütfen tekrar deneyin.', 500)
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

  const examOnly = assignment.training.examOnly === true
  return jsonResponse({
    ...attempt,
    examOnly,
    redirectTo: examOnly ? 'post-exam' : undefined,
  })
}
