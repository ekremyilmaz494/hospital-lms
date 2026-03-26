import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { getAttemptStatus } from '@/lib/exam-helpers'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // Phase guard: check attempt status for video access
  const attemptInfo = await getAttemptStatus(id, dbUser!.id)
  const attemptStatus = attemptInfo?.status ?? null
  // Videos accessible during watching_videos, post_exam (read-only), and completed phases
  // Only block during pre_exam (hasn't finished pre-exam yet)
  if (attemptStatus === 'pre_exam') {
    return errorResponse('Önce ön sınavı tamamlamalısınız', 403)
  }

  // id can be a trainingId — find the training and user's assignment
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { trainingId: id, userId: dbUser!.id },
  })

  // Also try as assignmentId
  const assignment2 = assignment ?? await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id },
  })

  const trainingId = assignment2?.trainingId ?? id

  const training = await prisma.training.findFirst({
    where: { id: trainingId },
    select: { id: true, title: true },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Get videos for this training
  const videos = await prisma.trainingVideo.findMany({
    where: { trainingId: training.id },
    orderBy: { sortOrder: 'asc' },
  })

  // BUG B-2 FIX: Sadece aktif (tamamlanmamış) denemenin video ilerlemesini getir
  const activeAttempt = await prisma.examAttempt.findFirst({
    where: {
      userId: dbUser!.id,
      trainingId: training.id,
      status: { not: 'completed' },
    },
    orderBy: { attemptNumber: 'desc' },
    select: { id: true },
  })

  const progress = activeAttempt
    ? await prisma.videoProgress.findMany({
        where: { attemptId: activeAttempt.id, videoId: { in: videos.map(v => v.id) } },
      })
    : []

  const progressMap = new Map(progress.map(p => [p.videoId, p]))

  return jsonResponse({
    trainingTitle: training.title,
    attemptStatus,
    videos: videos.map(v => {
      const p = progressMap.get(v.id)
      return {
        id: v.id,
        title: v.title,
        url: v.videoUrl,
        duration: v.durationSeconds,
        completed: p?.isCompleted ?? false,
        lastPosition: p?.lastPositionSeconds ?? 0,
      }
    }),
  })
}

/** POST — Update video progress (heartbeat + completion) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const body = await parseBody<{ videoId: string; watchedTime?: number; position?: number; completed?: boolean }>(request)
  if (!body?.videoId) return errorResponse('videoId required')

  // Find attempt — try assignmentId first, then trainingId
  let attempt = await prisma.examAttempt.findFirst({
    where: { assignmentId: id, userId: dbUser!.id, status: 'watching_videos' },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { trainingId: id, userId: dbUser!.id, status: 'watching_videos' },
    })
  }
  if (!attempt) return errorResponse('Aktif video izleme aşaması bulunamadı', 400)

  const video = await prisma.trainingVideo.findUnique({ where: { id: body.videoId } })
  if (!video) return errorResponse('Video not found', 404)

  const watchedSeconds = Math.min(Math.max(Math.round(body.watchedTime ?? body.position ?? 0), 0), video.durationSeconds)
  const lastPositionSeconds = Math.min(Math.max(Math.round(body.position ?? 0), 0), video.durationSeconds)
  const isCompleted = body.completed === true || watchedSeconds >= video.durationSeconds

  // Upsert video progress
  await prisma.videoProgress.upsert({
    where: { attemptId_videoId: { attemptId: attempt.id, videoId: body.videoId } },
    create: {
      attemptId: attempt.id,
      videoId: body.videoId,
      userId: dbUser!.id,
      watchedSeconds,
      totalSeconds: video.durationSeconds,
      lastPositionSeconds,
      isCompleted,
      ...(isCompleted && { completedAt: new Date() }),
    },
    update: {
      watchedSeconds: { set: watchedSeconds },
      lastPositionSeconds,
      ...(isCompleted && { isCompleted: true, completedAt: new Date() }),
    },
  })

  // Check if ALL videos are completed → transition to post_exam
  if (isCompleted) {
    const allVideos = await prisma.trainingVideo.findMany({
      where: { trainingId: attempt.trainingId },
      select: { id: true },
    })
    const completedCount = await prisma.videoProgress.count({
      where: { attemptId: attempt.id, isCompleted: true },
    })

    if (completedCount >= allVideos.length) {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { videosCompletedAt: new Date(), status: 'post_exam', postExamStartedAt: new Date() },
      })
      return jsonResponse({ progress: true, allVideosCompleted: true })
    }
  }

  return jsonResponse({ progress: true, allVideosCompleted: false })
}
