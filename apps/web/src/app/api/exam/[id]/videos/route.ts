import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getActiveOrLatestAttemptStatus } from '@/lib/exam-helpers'
import { resolveTrainingVideoUrl, resolveTrainingDocumentUrl } from '@/lib/training-video-url'
import { logger } from '@/lib/logger'
import type { AttemptStatus, AssignmentStatus } from '@/lib/exam-state-machine'

export const GET = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id } = params

  // Review mode: salt-okunur içerik görüntüleme — passed bir eğitimi tekrar izleme
  const url = new URL(request.url)
  const isReview = url.searchParams.get('mode') === 'review'

  // Phase guard: aktif (non-terminal) attempt'in status'üne bak. Latest attempt'i
  // okumak yetmiyor — start POST taze attempt yarattıktan sonra higher
  // attemptNumber'a sahip eski completed/expired attempt frontend'i terminal
  // redirect'e tetikleyebiliyordu (2026-05-20 Devakent incident).
  const attemptInfo = await getActiveOrLatestAttemptStatus(id, dbUser.id, organizationId)
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
      const [videoUrl, documentUrl] = await Promise.all([
        resolveTrainingVideoUrl(v),
        resolveTrainingDocumentUrl(v),
      ])
      return {
        id: v.id,
        title: v.title,
        url: videoUrl,
        duration: v.durationSeconds,
        contentType: v.contentType || 'video',
        pageCount: v.pageCount,
        completed: true,
        lastPosition: 0,
        documentUrl: documentUrl || undefined,
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
    // Tek kaynak: resolveTrainingVideoUrl() — signed CloudFront URL veya legacy /uploads path.
    // Hata olursa '' döner, frontend "İçerik yüklenemiyor" gösterir.
    const [url, documentUrl] = await Promise.all([
      resolveTrainingVideoUrl(v),
      resolveTrainingDocumentUrl(v),
    ])
    return {
      id: v.id,
      title: v.title,
      url,
      duration: v.durationSeconds,
      contentType: v.contentType || 'video',
      pageCount: v.pageCount,
      completed: p?.isCompleted ?? false,
      lastPosition: p?.lastPositionSeconds ?? 0,
      documentUrl: documentUrl || undefined,
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
    // Video: body.completed'i KALDIR, sadece watchedSeconds güven (anti-cheat).
    // Personel native controls ile ileri sarıp completion field'ı set etse bile
    // server-side hesaplama 80% eşiğini uygular.
    const requestedWatched = Math.min(
      Math.max(Math.round(body.watchedTime ?? body.position ?? 0), 0),
      video.durationSeconds,
    )

    // Geri sarma protection — videos/progress/route.ts'teki davranışı kopyala
    const existing = await prisma.videoProgress.findUnique({
      where: { attemptId_videoId: { attemptId: attempt.id, videoId: body.videoId } },
    })
    watchedSeconds = existing
      ? Math.max(requestedWatched, existing.watchedSeconds)
      : requestedWatched

    // İzleme hızı denetimi — wall-clock delta'sından %150 fazla artmasın.
    // Heartbeat aralığı mobile'da 5sn; 7.5sn watch + 5sn buffer = ~12.5sn max delta.
    if (existing) {
      const wallDelta = (Date.now() - existing.updatedAt.getTime()) / 1000
      const requestedDelta = watchedSeconds - existing.watchedSeconds
      const maxDelta = wallDelta * 1.5 + 5
      if (requestedDelta > maxDelta) {
        logger.warn('VideoProgress', 'Suspicious watch rate', {
          attemptId: attempt.id,
          videoId: body.videoId,
          requestedDelta,
          maxDelta,
        })
        watchedSeconds = existing.watchedSeconds + Math.floor(maxDelta)
      }
    }

    const requestedPosition = Math.min(
      Math.max(Math.round(body.position ?? 0), 0),
      video.durationSeconds,
    )
    // Stale beacon koruması: geç gelen pagehide/unmount sendBeacon (network gecikmesi
    // sonrası) yüksek bir pozisyonu geri sarmasın. watchedSeconds zaten Math.max ile
    // korunuyor; lastPositionSeconds için de aynı garantiyi ver. Aksi halde:
    //   t=0: kullanıcı 60s izledi → sendBeacon(pos=60) gönderildi, network'te bekliyor
    //   t=1: kullanıcı dönüp 90s'e kadar izledi → POST(pos=90) önce vardı
    //   t=2: gecikmiş sendBeacon vardı → pos=60'a düşürdü → resume 90 yerine 60'tan
    lastPositionSeconds = existing
      ? Math.max(requestedPosition, existing.lastPositionSeconds)
      : requestedPosition
    // 80% kural — /videos/progress ile aynı eşik
    const MIN_WATCH_PERCENT = 0.80
    isCompleted = watchedSeconds >= (video.durationSeconds * MIN_WATCH_PERCENT)
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
