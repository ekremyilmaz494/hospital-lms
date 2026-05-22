import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getActiveOrLatestAttemptStatus } from '@/lib/exam-helpers'
import { resolveTrainingVideoUrl, resolveTrainingDocumentUrl } from '@/lib/training-video-url'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { attemptNextStatus, type AttemptStatus, type AssignmentStatus } from '@/lib/exam-state-machine'

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
  // Only block during pre_exam (hasn't finished pre-exam yet).
  // 403 yerine 200 + attemptStatus dön: frontend phase guard (attemptPhaseRedirect)
  // kullanıcıyı pre-exam'e yönlendirir. 403 dönülürse videos sayfası `data` null
  // kalır, ölü "İçerik yüklenemedi" ekranı gösterir ve guard hiç çalışamaz.
  // videos:[] boş gönderilir — pre-exam'i bitirmemiş kullanıcıya video URL'i sızmaz.
  if (!isReview && attemptStatus === 'pre_exam') {
    return jsonResponse(
      { trainingTitle: '', attemptStatus: 'pre_exam', videos: [] },
      200,
      { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
    )
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

  // O1 — non-review akışta atama zorunlu. assignment2 yoksa kullanıcının bu
  // eğitime erişim hakkı yok; id'yi trainingId fallback'i olarak kullanıp aynı
  // org'daki herhangi bir eğitimin imzalı video URL'lerini sızdırma. Review
  // yolu kendi passed kontrolünü yapar (aşağıda), bu guard'ın dışında kalır.
  if (!isReview && !assignment2) {
    return errorResponse('Bu eğitim size atanmamış', 403)
  }

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

  // O6 — bu dönüş imzalı CloudFront video URL'leri içerir; ara cache'lenmemeli.
  // İmzalı URL süreli ve kullanıcıya özeldir, paylaşılan cache'te kalmamalı.
  return jsonResponse(
    {
      trainingTitle: training.title,
      attemptStatus,
      videos: videoList,
    },
    200,
    { 'Cache-Control': 'private, no-store' },
  )
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

  // O6 — write endpoint rate limit (kardeş videos/progress/route.ts deseni).
  const allowed = await checkRateLimit(`video-progress:${dbUser.id}`, 60, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

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
  // const binding — $transaction closure içinde `let attempt` narrowing'i
  // korunmaz; non-null garantili const referans kullan.
  const activeAttempt = attempt

  // Y3 — videoId bu attempt'in eğitimine ait olmalı; cross-training progress
  // yazımını engelle. findUnique tek başına yabancı bir video kabul ederdi.
  const video = await prisma.trainingVideo.findFirst({
    where: { id: body.videoId, trainingId: activeAttempt.trainingId },
  })
  if (!video) return errorResponse('Video içeriği bulunamadı', 404)

  const isPdfContent = video.contentType === 'pdf'

  // Y4 — read-compute-write race koruması. videoProgress satırını oku +
  // hesapla + yaz adımları atomik değildi; eşzamanlı iki POST düşük
  // watchedSeconds/lastPositionSeconds'ı sonradan yazıp ilerlemeyi geriye
  // düşürebilirdi (Math.max sadece TEK request içinde korur, race'te değil).
  // Çözüm: tüm read-compute-write'ı $transaction'a al ve attemptId+videoId
  // üzerinden transaction-scoped advisory lock ile serileştir. Advisory lock,
  // satır henüz yokken bile (ilk POST) seri çalışmayı garanti eder —
  // SELECT FOR UPDATE eksik satırda hiçbir şey kilitlemez. Lock transaction
  // sonunda otomatik bırakılır.
  const { isCompleted } = await prisma.$transaction(async (tx) => {
    // attemptId + videoId çiftine özgü transaction-scoped advisory lock.
    // hashtext() her UUID metnini int4'e çevirir; pg_advisory_xact_lock(int4,int4)
    // bu iki anahtarla satırı serileştirir.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${activeAttempt.id}), hashtext(${body.videoId}))`

    // Lock alındıktan SONRA mevcut ilerlemeyi oku — bu okuma artık yarış
    // kaybedemez; aynı çift için başka bir transaction sıraya girer.
    const existing = await tx.videoProgress.findUnique({
      where: { attemptId_videoId: { attemptId: activeAttempt.id, videoId: body.videoId } },
    })

    let nextWatched: number
    let nextPosition: number
    let nextCompleted: boolean

    if (isPdfContent) {
      // PDF: currentPage = mevcut sayfa, lastPositionSeconds = sayfa numarası
      const currentPage = Math.max(body.currentPage ?? 0, 0)
      const totalPages = video.pageCount ?? 1
      const requestedWatched = Math.min(currentPage, totalPages)
      // PDF yolu için de aynı geri-gitme garantisi (Y4).
      nextWatched = existing ? Math.max(requestedWatched, existing.watchedSeconds) : requestedWatched
      nextPosition = existing ? Math.max(currentPage, existing.lastPositionSeconds) : currentPage
      nextCompleted = body.completed === true || currentPage >= totalPages
    } else {
      // Süre GÜVENİLİR mi? (durationSeconds>0 — ölçülmüş veya backfill'lenmiş
      // kayıt). Güvenilmez süre (<=0 — ölçülememiş eski kayıt) izlenen saniyeyi
      // 0'a clamp'leyip videoyu sahte "tamamlandı" yapardı; bu durumda
      // durationCap sınırsız bırakılır, ilerleme 0'a düşürülmez. (Plan Faz 1.)
      const hasReliableDuration = video.durationSeconds > 0
      const durationCap = hasReliableDuration ? video.durationSeconds : Number.MAX_SAFE_INTEGER

      let requestedWatched = Math.min(
        Math.max(Math.round(body.watchedTime ?? body.position ?? 0), 0),
        durationCap,
      )

      // K1 — sunucu tarafı duvar-saati tavanı. existing-tabanlı hız denetimi
      // yalnız existing varken çalışıyordu; bir video için İLK POST'ta tam
      // süre gönderilince video tek istekte "tamamlandı" oluyordu. Bu, mevcut
      // ilerlemeyle max alınmadan ÖNCE uygulanan ek bir MUTLAK tavan: attempt
      // watching_videos'a girdiğinden bu yana geçen gerçek süreden (preExam
      // tamamlandı işareti) fazla izleme iddiası kabul edilmez.
      const maxWatchable = activeAttempt.preExamCompletedAt
        ? ((Date.now() - new Date(activeAttempt.preExamCompletedAt).getTime()) / 1000) * 1.5 + 30
        : 30
      requestedWatched = Math.min(requestedWatched, Math.floor(maxWatchable))

      // Geri sarma protection — Math.max ile mevcut ilerleme korunur; K1 cap'i
      // bu ifadeyi etkilemez (existing daha büyükse o kazanır).
      nextWatched = existing
        ? Math.max(requestedWatched, existing.watchedSeconds)
        : requestedWatched

      // İzleme hızı denetimi — wall-clock delta'sından %150 fazla artmasın.
      // Heartbeat aralığı mobile'da 5sn; 7.5sn watch + 5sn buffer = ~12.5sn max delta.
      if (existing) {
        const wallDelta = (Date.now() - existing.updatedAt.getTime()) / 1000
        const requestedDelta = nextWatched - existing.watchedSeconds
        const maxDelta = wallDelta * 1.5 + 5
        if (requestedDelta > maxDelta) {
          logger.warn('VideoProgress', 'Suspicious watch rate', {
            attemptId: activeAttempt.id,
            videoId: body.videoId,
            requestedDelta,
            maxDelta,
          })
          nextWatched = existing.watchedSeconds + Math.floor(maxDelta)
        }
      }

      const requestedPosition = Math.min(
        Math.max(Math.round(body.position ?? 0), 0),
        durationCap,
      )
      // Stale beacon koruması: geç gelen pagehide/unmount sendBeacon (network gecikmesi
      // sonrası) yüksek bir pozisyonu geri sarmasın. watchedSeconds zaten Math.max ile
      // korunuyor; lastPositionSeconds için de aynı garantiyi ver. Aksi halde:
      //   t=0: kullanıcı 60s izledi → sendBeacon(pos=60) gönderildi, network'te bekliyor
      //   t=1: kullanıcı dönüp 90s'e kadar izledi → POST(pos=90) önce vardı
      //   t=2: gecikmiş sendBeacon vardı → pos=60'a düşürdü → resume 90 yerine 60'tan
      nextPosition = existing
        ? Math.max(requestedPosition, existing.lastPositionSeconds)
        : requestedPosition
      // ── Video tamamlanma kapısı — DOĞAL BİTİŞ (onended) ZORUNLU ───────────
      // Tamamlanma YALNIZ video doğal sonuna ulaşınca verilir: frontend
      // <video> onEnded → POST { completed: true }. İzleme YÜZDESİ tek başına
      // tamamlama TETİKLEMEZ — personel videonun TAMAMINI izlemeden son sınava
      // geçemez (ürün kararı). 15sn'lik heartbeat POST'ları `completed`
      // göndermez; yalnız watchedSeconds/lastPosition günceller.
      //
      // NEDEN (Şikayet #1 — personel akıştan atılıyor): Yüzde eşiği (eski %80,
      // sonra %95) bir HEARTBEAT ile video bitmeden tetiklenebiliyordu →
      // attempt watching_videos'tan post_exam'e geçiyor → kullanıcı izlemeye
      // devam ederken sonraki heartbeat artık watching_videos attempt
      // bulamayıp 400 alıyor → frontend "Eğitim oturumu geçersiz" tam ekran
      // modalını açıp personeli atıyordu. Tamamlamayı tek kesin ana (onended)
      // sabitlemek bu yarışı kökten kaldırır: onended → completed → post_exam
      // ile frontend AYNI anda transition'a gider; geride post_exam attempt'e
      // çarpacak heartbeat kalmaz (heartbeat interval onended → isPlaying=false
      // ile zaten temizlenir).
      //
      // ANTI-CHEAT: body.completed:true taklit eden doğrudan POST'u engelle.
      // K1 duvar-saati tavanı + izleme-hızı denetimi nextWatched'i gerçekten
      // geçen süreye sabitliyor; tamamlama ek olarak izlenen sürenin videonun
      // büyük kısmını kapsamasını ister. Bu bir tamamlanma EŞİĞİ DEĞİL —
      // sahte-tamamlama alt sınırıdır; %90 oranı ölçülen oynatıcı süresi ile
      // DB durationSeconds arasındaki küçük sapmaya pay bırakır. Süre
      // güvenilmezse (durationSeconds<=0) alt sınır uygulanamaz; onended tek
      // ölçüt olur.
      const ANTI_CHEAT_WATCH_FLOOR = 0.9
      const watchedEnoughToComplete =
        !hasReliableDuration || nextWatched >= video.durationSeconds * ANTI_CHEAT_WATCH_FLOOR
      nextCompleted = body.completed === true && watchedEnoughToComplete
    }

    // Upsert video progress — lock altında, atomik. Eşzamanlı POST'lar sıraya
    // girip her biri en güncel existing'i gördüğü için ilerleme geriye düşmez.
    await tx.videoProgress.upsert({
      where: { attemptId_videoId: { attemptId: activeAttempt.id, videoId: body.videoId } },
      create: {
        attemptId: activeAttempt.id,
        videoId: body.videoId,
        userId: dbUser.id,
        watchedSeconds: nextWatched,
        totalSeconds: video.durationSeconds,
        lastPositionSeconds: nextPosition,
        isCompleted: nextCompleted,
        ...(nextCompleted && { completedAt: new Date() }),
      },
      update: {
        watchedSeconds: { set: nextWatched },
        lastPositionSeconds: nextPosition,
        ...(nextCompleted && { isCompleted: true, completedAt: new Date() }),
      },
    })

    return { isCompleted: nextCompleted }
  })

  // PDF içerikler opsiyoneldir — son sınava geçiş yalnızca video/ses tamamlanma şartına bağlı.
  // Bu nedenle PDF tamamlanması transition'ı tetiklemez ve sayıma da girmez.
  if (isCompleted && !isPdfContent) {
    const requiredVideos = await prisma.trainingVideo.findMany({
      where: { trainingId: activeAttempt.trainingId, contentType: { not: 'pdf' } },
      select: { id: true },
    })
    const completedCount = requiredVideos.length === 0 ? 0 : await prisma.videoProgress.count({
      where: {
        attemptId: activeAttempt.id,
        isCompleted: true,
        videoId: { in: requiredVideos.map(v => v.id) },
      },
    })

    if (requiredVideos.length > 0 && completedCount >= requiredVideos.length) {
      // State machine ile doğrula: watching_videos → post_exam (VIDEOS_COMPLETED).
      const transition = attemptNextStatus(activeAttempt.status as AttemptStatus, { type: 'VIDEOS_COMPLETED' })
      if (!transition.ok) return errorResponse(transition.reason, 400)
      // Atomik guard: yalnız hâlâ watching_videos iken güncelle. Doğrudan update
      // yerine status-filtreli updateMany — cron expire ya da başka bir POST
      // attempt'i terminal/post_exam yaptıysa geri açma (/videos/progress deseni).
      const advanced = await prisma.examAttempt.updateMany({
        where: { id: activeAttempt.id, status: 'watching_videos' satisfies AttemptStatus },
        data: { videosCompletedAt: new Date(), status: transition.next, postExamStartedAt: new Date() },
      })
      return jsonResponse({ progress: true, allVideosCompleted: advanced.count > 0 })
    }
  }

  return jsonResponse({ progress: true, allVideosCompleted: false })
}, { requireOrganization: true })
