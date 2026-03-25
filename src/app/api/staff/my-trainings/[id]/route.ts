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

  const t = assignment.training
  const latestAttempt = assignment.examAttempts[0] // sorted desc by attemptNumber
  const videoProgressMap = new Map(
    (latestAttempt?.videoProgress ?? []).map(vp => [vp.videoId, vp])
  )

  // Compute step completion based on attempt timestamps
  const preExamCompleted = assignment.examAttempts.some(a => a.preExamCompletedAt !== null)
  const preExamAttempt = assignment.examAttempts.find(a => a.preExamCompletedAt !== null)
  const videosCompleted = t.videos.length === 0 || t.videos.every(v => videoProgressMap.get(v.id)?.isCompleted ?? false) || assignment.examAttempts.some(a => a.videosCompletedAt !== null)
  const postExamCompleted = assignment.examAttempts.some(a => a.postExamCompletedAt !== null)

  const result = {
    id: t.id,
    assignmentId: assignment.id,
    title: t.title,
    category: t.category ?? '',
    description: t.description ?? '',
    passingScore: t.passingScore,
    maxAttempts: t.maxAttempts,
    examDuration: t.examDurationMinutes,
    status: assignment.status,
    currentAttempt: assignment.examAttempts.length,
    deadline: t.endDate ? t.endDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    preExamScore: preExamAttempt?.preExamScore ? Number(preExamAttempt.preExamScore) : undefined,
    preExamCompleted,
    videosCompleted,
    postExamCompleted,
    videos: t.videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, '0')}`,
      completed: videoProgressMap.get(v.id)?.isCompleted ?? false,
    })),
  }

  return jsonResponse(result)
}
