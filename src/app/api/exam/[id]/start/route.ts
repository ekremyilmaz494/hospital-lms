import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'

/** Start a new exam attempt or resume existing one */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: assignmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id: assignmentId, userId: dbUser!.id },
    include: { training: true },
  })

  if (!assignment) return errorResponse('Assignment not found', 404)

  // Egitim tarih araligi kontrolu
  const now = new Date()
  if (now < new Date(assignment.training.startDate)) {
    return errorResponse('Bu egitim henuz baslanmamis.', 403)
  }
  if (now > new Date(assignment.training.endDate)) {
    return errorResponse('Bu egitimin suresi dolmus.', 403)
  }

  if (assignment.status === 'passed') return errorResponse('Zaten başarıyla tamamladınız')
  if (assignment.status === 'locked') return errorResponse('Eğitim kilitlenmiş')
  if (assignment.status === 'failed' && assignment.currentAttempt >= assignment.maxAttempts) {
    return errorResponse('Maksimum deneme sayısına ulaştınız')
  }

  // Atomic: check for active attempt OR create new one inside a transaction
  const attempt = await prisma.$transaction(async (tx) => {
    // Check for active (incomplete) attempt
    const existing = await tx.examAttempt.findFirst({
      where: {
        assignmentId,
        userId: dbUser!.id,
        status: { not: 'completed' },
      },
      include: { videoProgress: true },
    })

    if (existing) return existing

    // Create new attempt
    const newAttemptNumber = assignment.currentAttempt + 1

    // BUG #4 FIX: maxAttempts kontrolü — transaction içinde throw
    if (newAttemptNumber > assignment.maxAttempts) {
      throw new Error('MAX_ATTEMPTS_EXCEEDED')
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
    throw err
  })

  if (!attempt) return errorResponse('Maksimum deneme sayısına ulaştınız', 403)

  return jsonResponse(attempt)
}
