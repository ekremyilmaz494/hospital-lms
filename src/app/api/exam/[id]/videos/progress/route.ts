import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { updateVideoProgressSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/redis'
import { attemptNextStatus, type AttemptStatus } from '@/lib/exam-state-machine'

/** Update video watch progress */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const allowed = await checkRateLimit(`video-progress:${dbUser!.id}`, 60, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody<{ videoId: string; watchedSeconds: number; lastPositionSeconds: number }>(request)
  if (!body?.videoId) return errorResponse('videoId required')

  const parsed = updateVideoProgressSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const attempt = await prisma.examAttempt.findFirst({ // perf-check-disable-line
    where: { id: attemptId, userId: dbUser!.id, status: 'watching_videos' },
    include: { training: { select: { organizationId: true } } },
  })

  if (!attempt) return errorResponse('Invalid attempt or not in video phase', 400)

  // Verify org isolation
  if (attempt.training.organizationId !== dbUser!.organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  // B7.2/G7.2 — videoId bu denemedeki eğitime ait olmalı; cross-training progress yazımını engelle
  const video = await prisma.trainingVideo.findFirst({ // perf-check-disable-line
    where: { id: body.videoId, trainingId: attempt.trainingId },
  })
  if (!video) return errorResponse('Video bulunamadı veya bu sınava ait değil', 404)

  // watchedSeconds & lastPositionSeconds: video suresiyle sinirla
  const safeWatchedSeconds = Math.min(parsed.data.watchedSeconds, video.durationSeconds)
  const safeLastPosition = Math.min(Math.max(parsed.data.lastPositionSeconds, 0), video.durationSeconds)

  // Onceki ilerlemeyi kontrol et (geri sarma engelleme)
  const existing = await prisma.videoProgress.findUnique({ // perf-check-disable-line
    where: { attemptId_videoId: { attemptId, videoId: body.videoId } },
  })
  const finalWatchedSeconds = existing
    ? Math.max(safeWatchedSeconds, existing.watchedSeconds)
    : safeWatchedSeconds

  // Minimum %80 izleme zorunlu — 1 saniye açıp kapatma engellenir
  const MIN_WATCH_PERCENT = 0.80
  const isCompleted = finalWatchedSeconds >= (video.durationSeconds * MIN_WATCH_PERCENT)

  const progress = await prisma.videoProgress.upsert({ // perf-check-disable-line
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
  const [allVideos, completedVideos] = await Promise.all([
    prisma.trainingVideo.findMany({
      where: { trainingId: attempt.trainingId },
      select: { id: true },
    }),
    prisma.videoProgress.count({
      where: { attemptId, isCompleted: true },
    }),
  ])

  if (allVideos.length === 0) {
    return errorResponse('Bu eğitime henüz video eklenmemiş.')
  }

  const allDone = completedVideos >= allVideos.length

  if (allDone) {
    // State machine ile validate: watching_videos → post_exam (VIDEOS_COMPLETED)
    const transition = attemptNextStatus(attempt.status as AttemptStatus, { type: 'VIDEOS_COMPLETED' })
    if (!transition.ok) {
      return errorResponse(transition.reason, 400)
    }
    // Atomic guard: sadece hala watching_videos iken update et (race protection)
    await prisma.examAttempt.updateMany({
      where: { id: attemptId, status: 'watching_videos' },
      data: { videosCompletedAt: new Date(), status: transition.next, postExamStartedAt: new Date() },
    })
  }

  return jsonResponse({ progress, allVideosCompleted: allDone })
}

/** Get all video progress for an attempt */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  // Verify attempt belongs to user's org
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id },
    include: { training: { select: { organizationId: true } } },
  })

  if (!attempt || attempt.training.organizationId !== dbUser!.organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  const progressList = await prisma.videoProgress.findMany({
    where: { attemptId, userId: dbUser!.id },
    include: { video: { select: { title: true, durationSeconds: true, sortOrder: true } } },
    orderBy: { video: { sortOrder: 'asc' } },
  })

  return jsonResponse(progressList, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
}
