import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getAttemptStatus } from '@/lib/exam-helpers'
import { getStreamUrl } from '@/lib/s3'
import type { AttemptStatus, AssignmentStatus } from '@/lib/exam-state-machine'

export const GET = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id } = params

  // Review mode: salt-okunur içerik görüntüleme — passed bir eğitimi tekrar izleme
  const url = new URL(request.url)
  const isReview = url.searchParams.get('mode') === 'review'

  // Phase guard: check attempt status for video access
  const attemptInfo = await getAttemptStatus(id, dbUser.id, organizationId)
  const attemptStatus = attemptInfo?.status ?? null
  // Videos accessible during watching_videos, post_exam (read-only), and completed phases
  // Only block during pre_exam (hasn't finished pre-exam yet)
  if (!isReview && attemptStatus === 'pre_exam') {
    return errorResponse('Önce ön sınavı tamamlamalısınız', 403)
  }

  // id can be a trainingId — find the training and user's assignment
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { trainingId: id, userId: dbUser.id },
    select: { id: true, trainingId: true, status: true },
  })

  // Also try as assignmentId
  const assignment2 = assignment ?? await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser.id },
    select: { id: true, trainingId: true, status: true },
  })

  const trainingId = assignment2?.trainingId ?? id

  const training = await prisma.training.findFirst({
    where: { id: trainingId, organizationId },
    select: { id: true, title: true },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Review mode passed kontrolü — tenant-safe (training yukarıda organizationId ile filtrelendi)
  if (isReview) {
    const [passedAttempt, passedAssignment] = await Promise.all([
      prisma.examAttempt.findFirst({
        where: {
          userId: dbUser.id,
          trainingId: training.id,
          organizationId,
          status: 'completed' satisfies AttemptStatus,
          isPassed: true,
        },
        select: { id: true },
      }),
      // trainingAssignment has no direct organizationId — training.id was already tenant-filtered above
      prisma.trainingAssignment.findFirst({
        where: {
          userId: dbUser.id,
          trainingId: training.id,
          status: 'passed' satisfies AssignmentStatus,
        },
        select: { id: true },
      }),
    ])

    if (!passedAttempt && !passedAssignment) {
      return errorResponse('Bu eğitimi tekrar izlemek için önce başarıyla tamamlamış olmanız gerekir', 403)
    }

    const videos = await prisma.trainingVideo.findMany({
      where: { trainingId: training.id },
      orderBy: { sortOrder: 'asc' },
    })

    const videoList = await Promise.all(videos.map(async (v) => {
      const hasS3Key = v.videoKey && !v.videoKey.startsWith('/uploads')
      const videoUrl = hasS3Key ? `/api/stream/${v.id}` : v.videoUrl
      const documentUrl = v.documentKey ? await getStreamUrl(v.documentKey) : undefined
      return {
        id: v.id,
        title: v.title,
        url: videoUrl,
        duration: v.durationSeconds,
        contentType: v.contentType || 'video',
        pageCount: v.pageCount,
        completed: true,
        lastPosition: 0,
        documentUrl,
      }
    }))

    return jsonResponse(
      {
        trainingTitle: training.title,
        attemptStatus: 'review',
        videos: videoList,
      },
      200,
      { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
    )
  }

  // Get videos for this training
  const videos = await prisma.trainingVideo.findMany({
    where: { trainingId: training.id },
    orderBy: { sortOrder: 'asc' },
  })

  // BUG B-2 FIX: Sadece aktif (tamamlanmamış) denemenin video ilerlemesini getir
  const activeAttempt = await prisma.examAttempt.findFirst({
    where: {
      userId: dbUser.id,
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

  const videoList = await Promise.all(videos.map(async (v) => {
    const p = progressMap.get(v.id)
    // S3 content → proxy through our API (avoids CORS issues)
    // Legacy /uploads videos → use path directly
    const hasS3Key = v.videoKey && !v.videoKey.startsWith('/uploads')
    const url = hasS3Key ? `/api/stream/${v.id}` : v.videoUrl
    const documentUrl = v.documentKey ? await getStreamUrl(v.documentKey) : undefined
    return {
      id: v.id,
      title: v.title,
      url,
      duration: v.durationSeconds,
      contentType: v.contentType || 'video',
      pageCount: v.pageCount,
      completed: p?.isCompleted ?? false,
      lastPosition: p?.lastPositionSeconds ?? 0,
      documentUrl,
    }
  }))

  return jsonResponse({
    trainingTitle: training.title,
    attemptStatus,
    videos: videoList,
  })
}, { requireOrganization: true })

/** POST — Update video progress (heartbeat + completion) */
export const POST = withStaffRoute<{ id: string }>(async ({ request, params, dbUser }) => {
  const { id } = params

  // Review mode: salt-okunur, progress yazma
  const url = new URL(request.url)
  const queryMode = url.searchParams.get('mode')
  const headerMode = request.headers.get('x-review-mode')

  const body = await parseBody<{ videoId: string; watchedTime?: number; position?: number; completed?: boolean; currentPage?: number; mode?: string }>(request)

  if (queryMode === 'review' || headerMode === 'review' || body?.mode === 'review') {
    return new Response(null, { status: 204 })
  }

  if (!body?.videoId) return errorResponse('videoId required')

  // Find attempt — try assignmentId first, then trainingId
  let attempt = await prisma.examAttempt.findFirst({
    where: { assignmentId: id, userId: dbUser.id, status: 'watching_videos' satisfies AttemptStatus },
  })
  if (!attempt) {
    attempt = await prisma.examAttempt.findFirst({
      where: { trainingId: id, userId: dbUser.id, status: 'watching_videos' satisfies AttemptStatus },
    })
  }
  if (!attempt) return errorResponse('Aktif video izleme aşaması bulunamadı', 400)

  const video = await prisma.trainingVideo.findUnique({ where: { id: body.videoId } })
  if (!video) return errorResponse('Video not found', 404)

  const isPdfContent = video.contentType === 'pdf'
  let watchedSeconds: number
  let lastPositionSeconds: number
  let isCompleted: boolean

  if (isPdfContent) {
    // PDF: currentPage = mevcut sayfa, lastPositionSeconds = sayfa numarası
    const currentPage = Math.max(body.currentPage ?? 0, 0)
    const totalPages = video.pageCount ?? 1
    watchedSeconds = Math.min(currentPage, totalPages)
    lastPositionSeconds = currentPage
    isCompleted = body.completed === true || currentPage >= totalPages
  } else {
    // Video: mevcut davranış
    watchedSeconds = Math.min(Math.max(Math.round(body.watchedTime ?? body.position ?? 0), 0), video.durationSeconds)
    lastPositionSeconds = Math.min(Math.max(Math.round(body.position ?? 0), 0), video.durationSeconds)
    isCompleted = body.completed === true || watchedSeconds >= video.durationSeconds
  }

  // Upsert video progress
  await prisma.videoProgress.upsert({
    where: { attemptId_videoId: { attemptId: attempt.id, videoId: body.videoId } },
    create: {
      attemptId: attempt.id,
      videoId: body.videoId,
      userId: dbUser.id,
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

  // PDF içerikler opsiyoneldir — son sınava geçiş yalnızca video/ses tamamlanma şartına bağlı.
  // Bu nedenle PDF tamamlanması transition'ı tetiklemez ve sayıma da girmez.
  if (isCompleted && !isPdfContent) {
    const requiredVideos = await prisma.trainingVideo.findMany({
      where: { trainingId: attempt.trainingId, contentType: { not: 'pdf' } },
      select: { id: true },
    })
    const completedCount = requiredVideos.length === 0 ? 0 : await prisma.videoProgress.count({
      where: {
        attemptId: attempt.id,
        isCompleted: true,
        videoId: { in: requiredVideos.map(v => v.id) },
      },
    })

    if (requiredVideos.length > 0 && completedCount >= requiredVideos.length) {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { videosCompletedAt: new Date(), status: 'post_exam', postExamStartedAt: new Date() },
      })
      return jsonResponse({ progress: true, allVideosCompleted: true })
    }
  }

  return jsonResponse({ progress: true, allVideosCompleted: false })
}, { requireOrganization: true })
