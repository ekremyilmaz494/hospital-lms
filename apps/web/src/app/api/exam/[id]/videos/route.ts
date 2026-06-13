import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers';
import { withStaffRoute } from '@/lib/api-handler';
import { resolveExamFlowState } from '@/lib/exam-flow-resolver';
import { resolveTrainingVideoUrl, resolveTrainingDocumentUrl } from '@/lib/training-video-url';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/redis';
import {
  attemptNextStatus,
  type AttemptStatus,
  type AssignmentStatus,
} from '@/lib/exam-state-machine';

export const GET = withStaffRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId }) => {
    const { id } = params;

    // Review mode: salt-okunur içerik görüntüleme — passed bir eğitimi tekrar izleme
    const url = new URL(request.url);
    const isReview = url.searchParams.get('mode') === 'review';

    // Tek doğruluk kaynağı: atama + attempt + aşama resolveExamFlowState'ten.
    // Aktif (non-terminal) attempt öncelikli; yoksa son attempt (terminal dahil) —
    // taze attempt eski terminal attempt'in arkasına gizlenmez (2026-05-20
    // Devakent incident). Atamalar-arası attemptNumber sıralaması YOK ("Yeniden
    // Ata" round'larında eski atamanın denemesi yenisini gölgelemez — Haziran
    // 2026 kök neden, N1).
    const state = await resolveExamFlowState(id, dbUser.id, organizationId);
    const attemptStatus = state.attempt?.status ?? null;
    // Videos accessible during watching_videos, post_exam (read-only), and completed phases
    // Only block during pre_exam (hasn't finished pre-exam yet).
    // 403 yerine 200 + attemptStatus dön: frontend phase guard (attemptPhaseRedirect)
    // kullanıcıyı pre-exam'e yönlendirir. 403 dönülürse videos sayfası `data` null
    // kalır, ölü "İçerik yüklenemedi" ekranı gösterir ve guard hiç çalışamaz.
    // videos:[] boş gönderilir — pre-exam'i bitirmemiş kullanıcıya video URL'i sızmaz.
    if (!isReview && attemptStatus === 'pre_exam') {
      return jsonResponse({ trainingTitle: '', attemptStatus: 'pre_exam', videos: [] }, 200, {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
      });
    }

    // O1 — non-review akışta atama zorunlu. Atama yoksa kullanıcının bu
    // eğitime erişim hakkı yok; id'yi trainingId fallback'i olarak kullanıp aynı
    // org'daki herhangi bir eğitimin imzalı video URL'lerini sızdırma. Review
    // yolu kendi passed kontrolünü yapar (aşağıda), bu guard'ın dışında kalır.
    if (!isReview && !state.assignment) {
      return errorResponse('Bu eğitim size atanmamış', 403);
    }

    const trainingId = state.assignment?.trainingId ?? id;

    const training = await prisma.training.findFirst({
      where: { id: trainingId, organizationId },
      select: { id: true, title: true },
    });

    if (!training) return errorResponse('Eğitim bulunamadı', 404);

    // Review mode passed kontrolü — tenant-safe (training yukarıda organizationId ile filtrelendi)
    if (isReview) {
      const [passedAttempt, passedAssignment] = await Promise.all([
        // Review yetki kontrolü: "geçmişte BU EĞİTİMİ geçmiş mi?" — aktif attempt
        // tespiti değil, tarihsel başarı sorgusu. Resolver kapsamı dışında.
        prisma.examAttempt.findFirst({ // perf-check-disable-line
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
      ]);

      if (!passedAttempt && !passedAssignment) {
        return errorResponse(
          'Bu eğitimi tekrar izlemek için önce başarıyla tamamlamış olmanız gerekir',
          403
        );
      }

      const videos = await prisma.trainingVideo.findMany({
        where: { trainingId: training.id },
        orderBy: { sortOrder: 'asc' },
      });

      const videoList = await Promise.all(
        videos.map(async (v) => {
          const [videoUrl, documentUrl] = await Promise.all([
            resolveTrainingVideoUrl(v),
            resolveTrainingDocumentUrl(v),
          ]);
          return {
            id: v.id,
            title: v.title,
            url: videoUrl,
            duration: v.durationSeconds,
            contentType: v.contentType || 'video',
            pageCount: v.pageCount,
            completed: true,
            lastPosition: 0,
            // Review modu salt-okunur; ilerleme yok ama şekil tutarlılığı için 0.
            watchedSeconds: 0,
            documentUrl: documentUrl || undefined,
          };
        })
      );

      return jsonResponse(
        {
          trainingTitle: training.title,
          attemptStatus: 'review',
          videos: videoList,
        },
        200,
        { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
      );
    }

    // Get videos for this training
    const videos = await prisma.trainingVideo.findMany({
      where: { trainingId: training.id },
      orderBy: { sortOrder: 'asc' },
    });

    // BUG B-2 FIX devamı: sadece AKTİF (non-terminal) denemenin video ilerlemesini
    // getir — resolver'ın activeAttempt alanı. Cron expire sonrası eski attempt'in
    // videoProgress'i yüklenmez → yanlış saniyeden resume yok. GET/POST/start aynı
    // resolver'ı kullandığı için okuma/yazma attempt uyumsuzluğu sınıfı kapandı.
    const activeAttempt = state.activeAttempt;

    const progress = activeAttempt
      ? await prisma.videoProgress.findMany({
          where: { attemptId: activeAttempt.id, videoId: { in: videos.map((v) => v.id) } },
        })
      : [];

    const progressMap = new Map(progress.map((p) => [p.videoId, p]));

    const videoList = await Promise.all(
      videos.map(async (v) => {
        const p = progressMap.get(v.id);
        // Tek kaynak: resolveTrainingVideoUrl() — signed CloudFront URL veya legacy /uploads path.
        // Hata olursa '' döner, frontend "İçerik yüklenemiyor" gösterir.
        const [url, documentUrl] = await Promise.all([
          resolveTrainingVideoUrl(v),
          resolveTrainingDocumentUrl(v),
        ]);
        return {
          id: v.id,
          title: v.title,
          url,
          duration: v.durationSeconds,
          contentType: v.contentType || 'video',
          pageCount: v.pageCount,
          completed: p?.isCompleted ?? false,
          lastPosition: p?.lastPositionSeconds ?? 0,
          // Gerçekte izlenen toplam süre — mobil resume'da izleme sayacını
          // konumdan değil bu değerden başlatır (ileri sarıp dönen kullanıcı
          // izlemediği süreyi kredi almasın; %90 anti-cheat eşiği korunsun).
          watchedSeconds: p?.watchedSeconds ?? 0,
          documentUrl: documentUrl || undefined,
        };
      })
    );

    // O6 — bu dönüş imzalı CloudFront video URL'leri içerir; ara cache'lenmemeli.
    // İmzalı URL süreli ve kullanıcıya özeldir, paylaşılan cache'te kalmamalı.
    return jsonResponse(
      {
        trainingTitle: training.title,
        attemptStatus,
        videos: videoList,
      },
      200,
      { 'Cache-Control': 'private, no-store' }
    );
  },
  { requireOrganization: true }
);

/** POST — Update video progress (heartbeat + completion) */
export const POST = withStaffRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId }) => {
    const { id } = params;

    // Review mode: salt-okunur, progress yazma
    const url = new URL(request.url);
    const queryMode = url.searchParams.get('mode');
    const headerMode = request.headers.get('x-review-mode');

    const body = await parseBody<{
      videoId: string;
      watchedTime?: number;
      position?: number;
      completed?: boolean;
      currentPage?: number;
      mode?: string;
      /**
       * Oynatıcının ÖLÇTÜĞÜ süre (video.duration, onended anında). DB'deki
       * durationSeconds gerçek oynatılabilir süreden BÜYÜKSE (transcode kırpması,
       * hatalı ffprobe, elle girilmiş değer) %90 tamamlama tabanı matematiksel
       * olarak asla tutmaz — video sonuna kadar izlense bile tamamlanamaz, client
       * iyimser işaretler, sunucu reddeder, sonraki girişte video "tamamlanmamış"
       * görünür (Haziran 2026 kök neden, N2). Taban min(DB, client) üzerinden
       * uygulanır; anti-cheat alt clamp'i aşağıda.
       */
      clientDuration?: number;
    }>(request);

    if (queryMode === 'review' || headerMode === 'review' || body?.mode === 'review') {
      return new Response(null, { status: 204 });
    }

    // O6 — write endpoint rate limit (kardeş videos/progress/route.ts deseni).
    const allowed = await checkRateLimit(`video-progress:${dbUser.id}`, 60, 60);
    if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429);

    if (!body?.videoId) return errorResponse('videoId required');

    // Attempt çözümü — GET ve start ile AYNI tek doğruluk kaynağı:
    // resolveExamFlowState. Atama önce kanonikleştirilir, attempt o atamaya
    // scope'lanır; atamalar-arası attemptNumber sıralaması yok ("Yeniden Ata"
    // round'larında progress yanlış attempt'e yazılmaz — Haziran 2026 N1).
    // organizationId resolver'ın her sorgusunda WHERE'de (cross-tenant IDOR önlemi).
    const flowState = await resolveExamFlowState(id, dbUser.id, organizationId);
    const resolvedAttempt = flowState.activeAttempt;
    if (!resolvedAttempt || resolvedAttempt.status !== ('watching_videos' satisfies AttemptStatus)) {
      return errorResponse('Aktif video izleme aşaması bulunamadı', 400);
    }
    const activeAttempt = resolvedAttempt;

    // Y3 — videoId bu attempt'in eğitimine ait olmalı; cross-training progress
    // yazımını engelle. findUnique tek başına yabancı bir video kabul ederdi.
    const video = await prisma.trainingVideo.findFirst({
      where: { id: body.videoId, trainingId: activeAttempt.trainingId },
    });
    if (!video) return errorResponse('Video içeriği bulunamadı', 404);

    const isPdfContent = video.contentType === 'pdf';

    // Y4 — read-compute-write race koruması. Tüm read-compute-write tek bir
    // $transaction içinde yapılır; aşağıdaki Math.max guard'ları
    // watchedSeconds/lastPositionSeconds'ın geriye gitmesini engeller.
    //
    // NOT (P0 düzeltmesi — 2026-05-22): Burada eskiden `tx.$queryRaw` ile
    // `pg_advisory_xact_lock` çağrılıp transaction-scoped bir advisory lock
    // alınıyordu. O ham SQL, Supabase + Prisma driver-adapter ortamında HER
    // POST'ta P2010 "Raw query failed" fırlatıp /api/exam/[id]/videos
    // endpoint'ini tamamen 500'e düşürdü — personelin video ilerlemesi hiç
    // kaydedilemedi. Advisory lock kaldırıldı. Kalan koruma yeterli:
    //   - $transaction find+upsert'i atomik tutar.
    //   - Math.max guard'ları ilerlemeyi geri gitmekten korur (nadir bir
    //     race'te değer birkaç saniye bayatlayabilir; sonraki 15sn heartbeat
    //     düzeltir).
    //   - isCompleted bir kez true olunca upsert update spread'i onu asla
    //     geri almaz (yalnız `&& { isCompleted: true }` ekler).
    // Cross-request serileştirme ileride gerçekten gerekirse `$queryRaw` ile
    // DEĞİL — void sonucu deserialize edilmediği için — `$executeRaw` ile
    // eklenmeli ve Supabase'de doğrulanmalı.
    const { isCompleted } = await prisma.$transaction(async (tx) => {
      // Mevcut ilerlemeyi oku — hesaplama ve yazımla aynı transaction içinde.
      const existing = await tx.videoProgress.findUnique({
        where: { attemptId_videoId: { attemptId: activeAttempt.id, videoId: body.videoId } },
      });

      let nextWatched: number;
      let nextPosition: number;
      let nextCompleted: boolean;

      if (isPdfContent) {
        // PDF: currentPage = mevcut sayfa, lastPositionSeconds = sayfa numarası
        const currentPage = Math.max(body.currentPage ?? 0, 0);
        const totalPages = video.pageCount ?? 1;
        const requestedWatched = Math.min(currentPage, totalPages);
        // PDF yolu için de aynı geri-gitme garantisi (Y4).
        nextWatched = existing
          ? Math.max(requestedWatched, existing.watchedSeconds)
          : requestedWatched;
        nextPosition = existing ? Math.max(currentPage, existing.lastPositionSeconds) : currentPage;
        nextCompleted = body.completed === true || currentPage >= totalPages;
      } else {
        // Süre GÜVENİLİR mi? (durationSeconds>0 — ölçülmüş veya backfill'lenmiş
        // kayıt). Güvenilmez süre (<=0 — ölçülememiş eski kayıt) izlenen saniyeyi
        // 0'a clamp'leyip videoyu sahte "tamamlandı" yapardı; bu durumda
        // durationCap sınırsız bırakılır, ilerleme 0'a düşürülmez. (Plan Faz 1.)
        const hasReliableDuration = video.durationSeconds > 0;
        const durationCap = hasReliableDuration ? video.durationSeconds : Number.MAX_SAFE_INTEGER;

        let requestedWatched = Math.min(
          Math.max(Math.round(body.watchedTime ?? body.position ?? 0), 0),
          durationCap
        );

        // K1 — sunucu tarafı duvar-saati tavanı. existing-tabanlı hız denetimi
        // yalnız existing varken çalışıyordu; bir video için İLK POST'ta tam
        // süre gönderilince video tek istekte "tamamlandı" oluyordu. Bu, mevcut
        // ilerlemeyle max alınmadan ÖNCE uygulanan ek bir MUTLAK tavan: attempt
        // watching_videos'a girdiğinden bu yana geçen gerçek süreden (preExam
        // tamamlandı işareti) fazla izleme iddiası kabul edilmez.
        // preExamCompletedAt boşsa attempt.createdAt'a düş — sabit 30sn tavanı,
        // baştan sona izlenmiş videoyu "asla tamamlanamaz" yapardı (savunmacı
        // fallback; mevcut akışlarda preExamCompletedAt watching_videos'a girişte
        // dolduruluyor, ama invariant kod katmanında zorlanmıyor).
        const baseTime = activeAttempt.preExamCompletedAt ?? activeAttempt.createdAt;
        const maxWatchable = ((Date.now() - new Date(baseTime).getTime()) / 1000) * 1.5 + 30;
        requestedWatched = Math.min(requestedWatched, Math.floor(maxWatchable));

        // Geri sarma protection — Math.max ile mevcut ilerleme korunur; K1 cap'i
        // bu ifadeyi etkilemez (existing daha büyükse o kazanır).
        nextWatched = existing
          ? Math.max(requestedWatched, existing.watchedSeconds)
          : requestedWatched;

        // İzleme hızı denetimi — wall-clock delta'sından %150 fazla artmasın.
        // Heartbeat aralığı mobile'da 5sn; 7.5sn watch + 5sn buffer = ~12.5sn max delta.
        if (existing) {
          const wallDelta = (Date.now() - existing.updatedAt.getTime()) / 1000;
          const requestedDelta = nextWatched - existing.watchedSeconds;
          const maxDelta = wallDelta * 1.5 + 5;
          if (requestedDelta > maxDelta) {
            logger.warn('VideoProgress', 'Suspicious watch rate', {
              attemptId: activeAttempt.id,
              videoId: body.videoId,
              requestedDelta,
              maxDelta,
            });
            nextWatched = existing.watchedSeconds + Math.floor(maxDelta);
          }
        }

        const requestedPosition = Math.min(
          Math.max(Math.round(body.position ?? 0), 0),
          durationCap
        );
        // Stale beacon koruması: geç gelen pagehide/unmount sendBeacon (network gecikmesi
        // sonrası) yüksek bir pozisyonu geri sarmasın. watchedSeconds zaten Math.max ile
        // korunuyor; lastPositionSeconds için de aynı garantiyi ver. Aksi halde:
        //   t=0: kullanıcı 60s izledi → sendBeacon(pos=60) gönderildi, network'te bekliyor
        //   t=1: kullanıcı dönüp 90s'e kadar izledi → POST(pos=90) önce vardı
        //   t=2: gecikmiş sendBeacon vardı → pos=60'a düşürdü → resume 90 yerine 60'tan
        nextPosition = existing
          ? Math.max(requestedPosition, existing.lastPositionSeconds)
          : requestedPosition;
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
        // N2 FIX (Haziran 2026): %90 tabanı DB durationSeconds yerine
        // min(DB, oynatıcı ölçümü) üzerinden uygulanır. DB süresi gerçek
        // oynatılabilir süreden büyükse (transcode kırpması, hatalı ffprobe)
        // taban asla tutmuyordu → video sonuna kadar izlense bile tamamlanamıyor,
        // her girişte "tamamlanmamış" görünüyordu. Anti-cheat korunur:
        //   - clientDuration alt clamp'i DB süresinin %60'ı — sahte küçük süre
        //     göndererek tabanı kaçırmak işe yaramaz (yine K1 duvar-saati tavanı
        //     + izleme hızı denetimi nextWatched'i gerçek süreye sabitliyor).
        //   - clientDuration yoksa/geçersizse eski davranış aynen geçerli.
        const ANTI_CHEAT_WATCH_FLOOR = 0.9;
        const CLIENT_DURATION_MIN_RATIO = 0.6;
        const rawClientDuration = Number(body.clientDuration);
        const clientDuration =
          Number.isFinite(rawClientDuration) && rawClientDuration > 0
            ? Math.round(rawClientDuration)
            : null;
        const effectiveDuration =
          hasReliableDuration && clientDuration !== null
            ? Math.max(
                Math.min(video.durationSeconds, clientDuration),
                Math.floor(video.durationSeconds * CLIENT_DURATION_MIN_RATIO),
              )
            : video.durationSeconds;
        const watchedEnoughToComplete =
          !hasReliableDuration || nextWatched >= effectiveDuration * ANTI_CHEAT_WATCH_FLOOR;
        nextCompleted = body.completed === true && watchedEnoughToComplete;
      }

      // Upsert video progress — $transaction içinde, atomik. Math.max guard'ları
      // (yukarıda) eşzamanlı yazımlarda ilerlemenin geriye gitmesini engeller.
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
      });

      return { isCompleted: nextCompleted };
    });

    // PDF içerikler opsiyoneldir — son sınava geçiş yalnızca video/ses tamamlanma şartına bağlı.
    // Bu nedenle PDF tamamlanması transition'ı tetiklemez ve sayıma da girmez.
    if (isCompleted && !isPdfContent) {
      const requiredVideos = await prisma.trainingVideo.findMany({
        where: { trainingId: activeAttempt.trainingId, contentType: { not: 'pdf' } },
        select: { id: true },
      });
      const completedCount =
        requiredVideos.length === 0
          ? 0
          : await prisma.videoProgress.count({
              where: {
                attemptId: activeAttempt.id,
                isCompleted: true,
                videoId: { in: requiredVideos.map((v) => v.id) },
              },
            });

      if (requiredVideos.length > 0 && completedCount >= requiredVideos.length) {
        // State machine ile doğrula: watching_videos → post_exam (VIDEOS_COMPLETED).
        const transition = attemptNextStatus(activeAttempt.status as AttemptStatus, {
          type: 'VIDEOS_COMPLETED',
        });
        if (!transition.ok) return errorResponse(transition.reason, 400);
        // Atomik guard: yalnız hâlâ watching_videos iken güncelle. Doğrudan update
        // yerine status-filtreli updateMany — cron expire ya da başka bir POST
        // attempt'i terminal/post_exam yaptıysa geri açma (/videos/progress deseni).
        // NOT: postExamStartedAt'ı burada SET ETME — son sınav saati personel sınava
        // fiilen girince (timer POST mount'ta) başlar. videos/progress/route.ts ile
        // tutarlı (İZEM CAN incident, 2026-06-03).
        const advanced = await prisma.examAttempt.updateMany({
          where: { id: activeAttempt.id, status: 'watching_videos' satisfies AttemptStatus },
          data: {
            videosCompletedAt: new Date(),
            status: transition.next,
          },
        });
        return jsonResponse({ progress: true, allVideosCompleted: advanced.count > 0 });
      }
    }

    return jsonResponse({ progress: true, allVideosCompleted: false });
  },
  { requireOrganization: true }
);
