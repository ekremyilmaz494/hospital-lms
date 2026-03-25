import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { updateVideoProgressSchema } from '@/lib/validations'

/** Update video watch progress */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const body = await parseBody<{ videoId: string; watchedSeconds: number; lastPositionSeconds: number }>(request)
  if (!body?.videoId) return errorResponse('videoId required')

  const parsed = updateVideoProgressSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id, status: 'watching_videos' },
  })

  if (!attempt) return errorResponse('Invalid attempt or not in video phase', 400)

  const video = await prisma.trainingVideo.findUnique({ where: { id: body.videoId } })
  if (!video) return errorResponse('Video not found', 404)

  // watchedSeconds & lastPositionSeconds: video suresiyle sinirla
  const safeWatchedSeconds = Math.min(parsed.data.watchedSeconds, video.durationSeconds)
  const safeLastPosition = Math.min(Math.max(parsed.data.lastPositionSeconds, 0), video.durationSeconds)

  // Onceki ilerlemeyi kontrol et (geri sarma engelleme)
  const existing = await prisma.videoProgress.findUnique({
    where: { attemptId_videoId: { attemptId, videoId: body.videoId } },
  })
  const finalWatchedSeconds = existing
    ? Math.max(safeWatchedSeconds, existing.watchedSeconds)
    : safeWatchedSeconds

  const isCompleted = finalWatchedSeconds >= video.durationSeconds

  const progress = await prisma.videoProgress.upsert({
    where: { attemptId_videoId: { attemptId, videoId: body.videoId } },
    create: {
      attemptId,
      videoId: body.videoId,
      userId: dbUser!.id,
      watchedSeconds: finalWatchedSeconds,
      totalSeconds: video.durationSeconds,
      lastPositionSeconds: safeLastPosition,
      isCompleted,
      ...(isCompleted && { completedAt: new Date() }),
    },
    update: {
      watchedSeconds: finalWatchedSeconds,
      lastPositionSeconds: safeLastPosition,
      isCompleted,
      ...(isCompleted && { completedAt: new Date() }),
    },
  })

  // Check if all videos are completed
  const allVideos = await prisma.trainingVideo.findMany({
    where: { trainingId: attempt.trainingId },
    select: { id: true },
  })

  const completedVideos = await prisma.videoProgress.count({
    where: { attemptId, isCompleted: true },
  })

  if (allVideos.length === 0) {
    return errorResponse('Bu eğitime henüz video eklenmemiş.')
  }

  const allDone = completedVideos >= allVideos.length

  if (allDone) {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { videosCompletedAt: new Date(), status: 'post_exam', postExamStartedAt: new Date() },
    })
  }

  return jsonResponse({ progress, allVideosCompleted: allDone })
}

/** Get all video progress for an attempt */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const progressList = await prisma.videoProgress.findMany({
    where: { attemptId, userId: dbUser!.id },
    include: { video: { select: { title: true, durationSeconds: true, sortOrder: true } } },
    orderBy: { video: { sortOrder: 'asc' } },
  })

  return jsonResponse(progressList)
}
