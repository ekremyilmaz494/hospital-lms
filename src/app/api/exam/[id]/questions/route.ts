import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // id can be trainingId or assignmentId — find the training
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id },
    include: { training: true },
  })

  // If not found by assignment ID, try as training ID
  const training = assignment?.training ?? await prisma.training.findFirst({
    where: { id },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Get questions with options (exclude isCorrect for security)
  const questions = await prisma.question.findMany({
    where: { trainingId: training.id },
    include: {
      options: {
        select: { id: true, optionText: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse({
    trainingTitle: training.title,
    examType: 'Ön Sınav',
    totalTime: training.examDurationMinutes * 60,
    questions: questions.map((q, idx) => ({
      id: idx + 1,
      questionId: q.id,
      text: q.questionText,
      options: q.options.map((o, oIdx) => ({
        id: String.fromCharCode(97 + oIdx), // a, b, c, d
        optionId: o.id,
        text: o.optionText,
      })),
    })),
  })
}
