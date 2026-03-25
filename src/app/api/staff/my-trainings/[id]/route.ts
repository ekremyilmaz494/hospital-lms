import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id },
    include: {
      training: {
        include: {
          videos: { orderBy: { sortOrder: 'asc' } },
          questions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
        },
      },
      examAttempts: {
        include: { videoProgress: true, examAnswers: true },
        orderBy: { attemptNumber: 'desc' },
      },
    },
  })

  if (!assignment) return errorResponse('Assignment not found', 404)

  // Strip correct answers from questions (don't leak to client)
  const sanitizedTraining = {
    ...assignment.training,
    questions: assignment.training.questions.map(q => ({
      ...q,
      options: q.options.map(({ isCorrect, ...rest }) => rest),
    })),
  }

  return jsonResponse({ ...assignment, training: sanitizedTraining })
}
