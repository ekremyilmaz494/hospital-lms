import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { updateVideoProgressSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { attemptNextStatus, type AttemptStatus } from '@/lib/exam-state-machine'

/** Update video watch progress */
export const POST = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id: attemptId } = params

  const allowed = await checkRateLimit(`video-progress:${dbUser.id}`, 60, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody<{ videoId: string; watchedSeconds: number; lastPositionSeconds: number }>(request)
  if (!body?.videoId) return errorResponse('videoId required')

  const parsed = updateVideoProgressSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  // status filter atomic guard — pre_exam/post_exam fazındaki attempt'e video progress
  // yazılması state corruption'a yol açar (bkz. exam-state-machine.ts kapsam notu:
  // DB filter literal'ları transition değil guard amacıyla kullanılır).
  // organizationId WHERE'de (pre-filter) — sorgu hiç başka tenant satırını getirmesin.
  // Aşağıdaki post-query kontrolü ikinci katman olarak korunur (defense-in-depth).
  const attempt = await prisma.examAttempt.findFirst({ // perf-check-disable-line
    where: { id: attemptId, userId: dbUser.id, organizationId, status: 'watching_videos' satisfies AttemptStatus },
    include: { training: { select: { organizationId: true } } },
  })

  if (!attempt) return errorResponse('Invalid attempt or not in video phase', 400)

  // Verify org isolation (ikinci katman — WHERE zaten org'u filtreliyor)
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  // B7.2/G7.2 — videoId bu denemedeki eğitime ait olmalı; cross-training progress yazımını engelle
  const video = await prisma.trainingVideo.findFirst({ // perf-check-disable-line
    where: { id: body.videoId, trainingId: attempt.trainingId },
  })
  if (!video) return errorResponse('Video bulunamadı veya bu sınava ait değil', 404)

  // Duvar-saati tavanı (K1 yansıması) — videos/route.ts ile aynı anti-cheat.
  // İstemci watchedSeconds'ı doğrudan gönderiyor; tavan olmadan ilk POST'ta tam
  // süre gönderip videoyu tek seferde tamamlatabilir. preExamCompletedAt'tan bu
  // yana geçen gerçek süreyi %150 + 30sn tolerans ile cap'liyoruz.
  // preExamCompletedAt boşsa attempt.createdAt'a düş (videos/route.ts:362 ile
  // aynı) — eski sabit 30sn tavanı, retry/examOnly gibi preExam damgası olmayan
  // akışlarda videoyu "asla tamamlanamaz" yapıyordu.
  const baseTime = attempt.preExamCompletedAt ?? attempt.createdAt
  const maxWatchable = ((Date.now() - new Date(baseTime).getTime()) / 1000) * 1.5 + 30
  const wallCappedWatchedSeconds = Math.min(parsed.data.watchedSeconds, Math.floor(maxWatchable))

  // watchedSeconds & lastPositionSeconds: video suresiyle sinirla
  const safeWatchedSeconds = Math.min(wallCappedWatchedSeconds, video.durationSeconds)
  const safeLastPosition = Math.min(Math.max(parsed.data.lastPositionSeconds, 0), video.durationSeconds)

  // Onceki ilerlemeyi kontrol et (geri sarma engelleme)
  const existing = await prisma.videoProgress.findUnique({ // perf-check-disable-line
    where: { attemptId_videoId: { attemptId, videoId: body.videoId } },
  })
  let finalWatchedSeconds = existing
    ? Math.max(safeWatchedSeconds, existing.watchedSeconds)
    : safeWatchedSeconds

  // İzleme hızı denetimi — videos/route.ts'teki desenle aynı. watchedSeconds
  // mevcut değerden, son güncellemeden bu yana geçen duvar-saati süresinin
  // %150'sinden + 5sn buffer'dan fazla artamaz (heartbeat jitter toleransı).
  if (existing) {
    const wallDelta = (Date.now() - existing.updatedAt.getTime()) / 1000
    const requestedDelta = finalWatchedSeconds - existing.watchedSeconds
    const maxDelta = wallDelta * 1.5 + 5
    if (requestedDelta > maxDelta) {
      logger.warn('VideoProgress', 'Suspicious watch rate', {
        attemptId,
        videoId: body.videoId,
        requestedDelta,
        maxDelta,
      })
      finalWatchedSeconds = existing.watchedSeconds + Math.floor(maxDelta)
    }
  }
  // lastPositionSeconds için de geri-gitme koruması — stale sendBeacon (network
  // gecikmesi sonrası gelen pagehide) yüksek pozisyonu sıfırlamasın. Resume
  // bug'ı bu olmadan iki yazımın race'inde yine ortaya çıkar.
  const finalLastPosition = existing
    ? Math.max(safeLastPosition, existing.lastPositionSeconds)
    : safeLastPosition

  // Minimum %95 izleme zorunlu — videos/route.ts ile aynı eşik.
  const MIN_WATCH_PERCENT = 0.95
  // Sıfır süre koruması: durationSeconds<=0 (ölçülememiş eski/bozuk kayıt) iken
  // 0 >= 0*0.95 her POST'ta true olup videoyu ilk istekte tamamlardı. Süre
  // güvenilir değilse tamamlanma verilmez — bu route'ta açık bir bitiş sinyali
  // (onended) yok, dolayısıyla durationSeconds<=0 iken isCompleted=false kalır.
  const hasReliableDuration = video.durationSeconds > 0
  const meetsWatchThreshold = hasReliableDuration
    ? finalWatchedSeconds >= (video.durationSeconds * MIN_WATCH_PERCENT)
    : false
  // B2 — geriye-uyumlu açık tamamlanma sinyali:
  //  • `completed` GÖNDERİLMEDİYSE (eski Expo istemcisi) → yalnız %95 eşiği (mevcut davranış korunur).
  //  • `completed` GÖNDERİLDİYSE (yeni istemci) → %95 eşiği VE completed===true birlikte gerekir.
  // Böylece yeni istemci videonun ortasında %95'i geçince değil, yalnız fiilen bittiğini
  // (onEnded) bildirince tamamlanır — CLAUDE.md "tamamlanma yalnız onEnded ile" kuralına
  // yaklaşır. Eşik (0.95) DEĞİŞMEZ; regresyon testi (progress/__tests__) bunu kilitliyor.
  const isCompleted = parsed.data.completed === undefined
    ? meetsWatchThreshold
    : (parsed.data.completed === true && meetsWatchThreshold)

  const progress = await prisma.videoProgress.upsert({ // perf-check-disable-line
    where: { attemptId_videoId: { attemptId, videoId: body.videoId } },
    create: {
      attemptId,
      videoId: body.videoId,
      userId: dbUser.id,
      watchedSeconds: finalWatchedSeconds,
      totalSeconds: video.durationSeconds,
      lastPositionSeconds: finalLastPosition,
      isCompleted,
      ...(isCompleted && { completedAt: new Date() }),
    },
    update: {
      watchedSeconds: finalWatchedSeconds,
      lastPositionSeconds: finalLastPosition,
      isCompleted,
      ...(isCompleted && { completedAt: new Date() }),
    },
  })

  // Check if all videos are completed
  // PDF içerikler opsiyoneldir — son sınava geçiş yalnızca video/ses tamamlanma
  // şartına bağlı (videos/route.ts ile aynı). PDF'leri sayıma katma. completedVideos
  // sayımı da yalnız bu non-PDF video kümesine scope'lanır (PDF tamamlanması
  // sayıma sızıp transition'ı erken tetiklemesin).
  const allVideos = await prisma.trainingVideo.findMany({
    where: { trainingId: attempt.trainingId, contentType: { not: 'pdf' } },
    select: { id: true },
  })

  if (allVideos.length === 0) {
    return errorResponse('Bu eğitime henüz video eklenmemiş.')
  }

  const completedVideos = await prisma.videoProgress.count({
    where: { attemptId, isCompleted: true, videoId: { in: allVideos.map(v => v.id) } },
  })

  const allDone = completedVideos >= allVideos.length

  if (allDone) {
    // State machine ile validate: watching_videos → post_exam (VIDEOS_COMPLETED)
    const transition = attemptNextStatus(attempt.status as AttemptStatus, { type: 'VIDEOS_COMPLETED' })
    if (!transition.ok) {
      return errorResponse(transition.reason, 400)
    }
    // Atomic guard: sadece hala watching_videos iken update et (race protection)
    // NOT: postExamStartedAt'ı burada SET ETME. Son sınav saati video bitiminde değil,
    // personel son sınava fiilen girince (timer POST mount'ta) başlar — aksi halde
    // video↔sınav arası gecikme süreyi eritir (İZEM CAN incident, 2026-06-03).
    await prisma.examAttempt.updateMany({
      where: { id: attemptId, status: 'watching_videos' satisfies AttemptStatus },
      data: { videosCompletedAt: new Date(), status: transition.next },
    })
  }

  return jsonResponse({ progress, allVideosCompleted: allDone })
}, { requireOrganization: true })

/** Get all video progress for an attempt */
export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id: attemptId } = params

  // Verify attempt belongs to user's org — organizationId WHERE'de (pre-filter);
  // aşağıdaki kontrol ikinci katman olarak kalır.
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser.id, organizationId },
    include: { training: { select: { organizationId: true } } },
  })

  if (!attempt || attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  const progressList = await prisma.videoProgress.findMany({
    where: { attemptId, userId: dbUser.id },
    include: { video: { select: { title: true, durationSeconds: true, sortOrder: true } } },
    orderBy: { video: { sortOrder: 'asc' } },
  })

  return jsonResponse(progressList, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
}, { requireOrganization: true })
