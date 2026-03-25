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
  if (assignment.status === 'passed') return errorResponse('Zaten başarıyla tamamladınız')
  if (assignment.status === 'locked') return errorResponse('Eğitim kilitlenmiş')
  if (assignment.currentAttempt >= assignment.maxAttempts) {
    return errorResponse('Maksimum deneme sayısına ulaştınız')
  }

  // Check for active (incomplete) attempt
  let attempt = await prisma.examAttempt.findFirst({
    where: {
      assignmentId,
      userId: dbUser!.id,
      status: { not: 'completed' },
    },
    include: { videoProgress: true },
  })

  if (!attempt) {
    // Create new attempt
    const newAttemptNumber = assignment.currentAttempt + 1

    attempt = await prisma.examAttempt.create({
      data: {
        assignmentId,
        userId: dbUser!.id,
        trainingId: assignment.trainingId,
        attemptNumber: newAttemptNumber,
        status: 'pre_exam',
        preExamStartedAt: new Date(),
      },
      include: { videoProgress: true },
    })

    await prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: { currentAttempt: newAttemptNumber, status: 'in_progress' },
    })
  }

  return jsonResponse(attempt)
}
