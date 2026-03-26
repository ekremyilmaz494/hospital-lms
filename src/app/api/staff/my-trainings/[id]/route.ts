import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  // Find assignment — try by ID, then by trainingId
  let assignment = await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id },
    include: {
      training: {
        include: {
          videos: { orderBy: { sortOrder: 'asc' } },
        },
      },
      examAttempts: {
        include: { videoProgress: true },
        orderBy: { attemptNumber: 'desc' },
      },
    },
  })

  if (!assignment) {
    assignment = await prisma.trainingAssignment.findFirst({
      where: { trainingId: id, userId: dbUser!.id },
      include: {
        training: {
          include: {
            videos: { orderBy: { sortOrder: 'asc' } },
          },
        },
        examAttempts: {
          include: { videoProgress: true },
          orderBy: { attemptNumber: 'desc' },
        },
      },
    })
  }

  if (!assignment) return errorResponse('Assignment not found', 404)

  const t = assignment.training
  const latestAttempt = assignment.examAttempts[0] // highest attemptNumber (desc sort)

  // ═══ STATE DETECTION ═══
  // 4 possible states:
  // 0. FRESH: no attempts yet → user hasn't started
  // 1. ACTIVE: latest attempt exists and is NOT completed → user is mid-exam
  // 2. RETRY_PENDING: latest attempt completed + failed + attempts remain → waiting for new attempt
  // 3. DONE: passed or all attempts exhausted

  const isFresh = !latestAttempt
  const isActive = !isFresh && latestAttempt.status !== 'completed'
  const isRetryPending = !isFresh && latestAttempt.status === 'completed' &&
    latestAttempt.isPassed !== true &&
    assignment.currentAttempt < assignment.maxAttempts

  // ═══ DETERMINE STEP PROGRESS ═══
  let currentAttempt: number
  let preExamCompleted: boolean
  let videosCompleted: boolean
  let postExamCompleted: boolean

  if (isFresh) {
    // Henüz hiç deneme yapılmamış — her şey sıfır
    currentAttempt = 0
    preExamCompleted = false
    videosCompleted = false
    postExamCompleted = false
  } else if (isRetryPending) {
    // User failed, needs to start a new attempt
    currentAttempt = assignment.currentAttempt + 1
    preExamCompleted = true    // 2+ denemede ön sınav atlanır
    videosCompleted = false    // videolar sıfırdan izlenmeli
    postExamCompleted = false  // son sınav tekrar girilmeli
  } else if (isActive) {
    // Active attempt in progress
    currentAttempt = assignment.currentAttempt
    const isRetry = latestAttempt.attemptNumber > 1
    preExamCompleted = isRetry || latestAttempt.preExamCompletedAt !== null
    // Video completion: check THIS attempt's video progress only
    const attemptVideoProgress = new Map(
      (latestAttempt.videoProgress ?? []).map(vp => [vp.videoId, vp])
    )
    videosCompleted = t.videos.length === 0 ||
      (latestAttempt.videosCompletedAt !== null) ||
      t.videos.every(v => attemptVideoProgress.get(v.id)?.isCompleted === true)
    postExamCompleted = latestAttempt.postExamCompletedAt !== null
  } else {
    // Passed or all attempts exhausted
    currentAttempt = assignment.currentAttempt
    preExamCompleted = true
    videosCompleted = true
    postExamCompleted = true // Tüm süreç bitti (geçti veya haklar tükendi)
  }

  // ═══ VIDEO LIST — always use active/latest non-completed attempt's progress ═══
  const activeAttemptForVideos = isRetryPending ? null : (isActive ? latestAttempt : null)
  const videoProgressMap = new Map(
    (activeAttemptForVideos?.videoProgress ?? []).map(vp => [vp.videoId, vp])
  )

  // Pre-exam score from first attempt
  const firstAttempt = assignment.examAttempts[assignment.examAttempts.length - 1]
  const preExamScore = firstAttempt?.preExamScore ? Number(firstAttempt.preExamScore) : undefined

  return jsonResponse({
    id: t.id,
    assignmentId: assignment.id,
    title: t.title,
    category: t.category ?? '',
    description: t.description ?? '',
    passingScore: t.passingScore,
    maxAttempts: assignment.maxAttempts,
    examDuration: t.examDurationMinutes,
    status: assignment.status,
    currentAttempt,
    deadline: t.endDate ? t.endDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    preExamScore,
    preExamCompleted,
    videosCompleted,
    postExamCompleted,
    needsRetry: isRetryPending,
    videos: t.videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, '0')}`,
      completed: isRetryPending ? false : (videoProgressMap.get(v.id)?.isCompleted ?? false),
    })),
  })
}
