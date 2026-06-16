import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse } from '@/lib/api-helpers';
import { withStaffRoute } from '@/lib/api-handler';
import { logActivity } from '@/lib/activity-logger';
import { isEndDatePassed } from '@/lib/date-helpers';
import { isAttemptFeedbackTriggered } from '@/lib/feedback-helpers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withStaffRoute<{ id: string }>(
  async ({ params, dbUser, organizationId }) => {
    const { id } = await params;

    // B8.2/G8.2 — Parametre UUID formatında olmalı; hatalı değerler DB'ye ulaşmadan reddedilsin
    if (!UUID_REGEX.test(id)) return errorResponse('Geçersiz eğitim ID', 400);

    // Arşivlenmiş veya soft-delete edilmiş eğitimler erişilemez (personel direct URL ile bile açamaz).
    const trainingFilter = {
      organizationId,
      isActive: true,
      publishStatus: { not: 'archived' },
    };

    // Find assignment — try by ID, then by trainingId
    let assignment = await prisma.trainingAssignment.findFirst({
      where: {
        id,
        userId: dbUser.id,
        training: trainingFilter,
      },
      include: {
        training: {
          include: {
            videos: {
              select: {
                id: true,
                title: true,
                durationSeconds: true,
                sortOrder: true,
                contentType: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
            // questionCount — liste endpoint'i (my-trainings/route.ts) ile BİREBİR
            // aynı: ham soru sayısı. Mobil, sınav başlamadan önceki bilgilendirme
            // ekranında gösterir (questions endpoint'i faz koruması yüzünden öncesinde 403).
            _count: { select: { questions: true } },
          },
        },
        examAttempts: {
          select: {
            attemptNumber: true,
            status: true,
            isPassed: true,
            preExamScore: true,
            postExamScore: true,
            preExamCompletedAt: true,
            videosCompletedAt: true,
            postExamStartedAt: true,
            postExamCompletedAt: true,
            videoProgress: { select: { videoId: true, isCompleted: true } },
          },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!assignment) {
      assignment = await prisma.trainingAssignment.findFirst({
        where: {
          trainingId: id,
          userId: dbUser.id,
          training: trainingFilter,
        },
        // Aynı eğitimde birden çok atama (Yeniden Ata round'u) olabilir. orderBy'sız
        // findFirst non-deterministik bir round seçip exam-flow ile çelişen aşama/attempt
        // gösterebilir (N1 sınıfı). resolveExamFlowState ile AYNI sıralama: en yeni round.
        orderBy: [{ round: 'desc' }, { assignedAt: 'desc' }],
        include: {
          training: {
            include: {
              videos: {
                select: {
                  id: true,
                  title: true,
                  durationSeconds: true,
                  sortOrder: true,
                  contentType: true,
                },
                orderBy: { sortOrder: 'asc' },
              },
              // questionCount — liste endpoint'i ile birebir aynı (ham soru sayısı).
              _count: { select: { questions: true } },
            },
          },
          examAttempts: {
            select: {
              attemptNumber: true,
              status: true,
              isPassed: true,
              preExamScore: true,
              postExamScore: true,
              preExamCompletedAt: true,
              videosCompletedAt: true,
              postExamStartedAt: true,
              postExamCompletedAt: true,
              videoProgress: { select: { videoId: true, isCompleted: true } },
            },
            orderBy: { attemptNumber: 'desc' },
            take: 1,
          },
        },
      });
    }

    if (!assignment) return errorResponse('Eğitim ataması bulunamadı', 404);

    void logActivity({
      userId: dbUser.id,
      organizationId,
      action: 'course_view',
      resourceType: 'course',
      resourceId: assignment.training.id,
      resourceTitle: assignment.training.title,
    });

    const t = assignment.training;
    const latestAttempt = assignment.examAttempts[0]; // only attempt fetched (desc take:1)

    // Per-atama dueDate (2. tur override) varsa training.endDate yerine onu kullan —
    // api/exam/[id]/start route'u ile AYNI mantık (effectiveDueDate). Aksi halde detay
    // "tekrar dene" CTA'sı gösterir ama start route 403 "süresi dolmuş" döndürüp ölü
    // ekran yaratır (tarih tutarsızlığı bug'ı). End-of-day mantığı: "16 Mayıs" son
    // tarihliyse 16 May 23:59:59'a kadar açık.
    const effectiveDueDate = assignment.dueDate ?? t.endDate;
    const isExpired = isEndDatePassed(effectiveDueDate);

    // ═══ EY.FR.40 — eğitime özel gönüllü geri bildirim durumu ═══
    // latestAttempt feedback'i TETİKLEYEN attempt olmayabilir (örn. attempt 2 passed,
    // sonra admin ek hak verdi, attempt 4 in_progress). feedback/status ve
    // getAllPendingFeedback ile aynı kural: TÜM completed attempt'leri tara, ilk
    // tetikleyeni seç. organizationId filtresi form sorgusunda; diğer iki sorgu
    // trainingId: t.id ile zaten org-doğrulanmış bir eğitime kapsanır.
    const [activeFeedbackForm, priorFeedback, completedAttempts] = await Promise.all([
      prisma.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true, isArchived: false },
        select: { id: true },
      }),
      prisma.trainingFeedbackResponse.findFirst({
        where: { trainingId: t.id, attempt: { userId: dbUser.id } },
        select: { submittedAt: true },
      }),
      prisma.examAttempt.findMany({
        where: { trainingId: t.id, userId: dbUser.id, status: 'completed' },
        select: { id: true, status: true, isPassed: true, attemptNumber: true },
        orderBy: { postExamCompletedAt: 'desc' },
      }),
    ]);

    const triggeringAttempt = completedAttempts.find((a) =>
      isAttemptFeedbackTriggered(a, assignment.originalMaxAttempts)
    );
    const feedbackFormActive = activeFeedbackForm !== null;
    const feedbackSubmitted = priorFeedback !== null;

    // ═══ STATE DETECTION ═══
    // 4 possible states:
    // 0. FRESH: no attempts yet → user hasn't started
    // 1. ACTIVE: latest attempt exists and is NOT completed → user is mid-exam
    // 2. RETRY_PENDING: latest attempt completed + failed + attempts remain → waiting for new attempt
    // 3. DONE: passed or all attempts exhausted

    const isFresh = !latestAttempt;
    const isActive =
      !isFresh && latestAttempt.status !== 'completed' && latestAttempt.status !== 'expired';
    const isRetryPending =
      !isFresh &&
      latestAttempt.status === 'completed' &&
      latestAttempt.isPassed !== true &&
      assignment.currentAttempt < assignment.maxAttempts;
    // Cron 'expired' işaretlemişse (eğitim süresi doldu veya 24h stale) kullanıcının
    // hâlâ deneme hakkı varsa "Yeniden dene" CTA'sını göster — aksi halde detayda
    // takılıp ne yapacağını anlamıyor (RADYASYON 2026-05-16 incident).
    // GERÇEKTEN süresi dolmuş eğitimde (effectiveDueDate geçmiş) retry gösterme:
    // start route nasılsa 403 döndürür, bunun yerine isExpired banner'ı gösterilir.
    const isExpiredRetryable =
      !isFresh &&
      latestAttempt.status === 'expired' &&
      assignment.currentAttempt < assignment.maxAttempts &&
      !isExpired;

    // ═══ DETERMINE STEP PROGRESS ═══
    let currentAttempt: number;
    let preExamCompleted: boolean;
    let videosCompleted: boolean;
    let postExamCompleted: boolean;

    if (isFresh) {
      // Henüz hiç deneme yapılmamış — her şey sıfır
      currentAttempt = 0;
      preExamCompleted = false;
      videosCompleted = false;
      postExamCompleted = false;
    } else if (isRetryPending) {
      // User failed, needs to start a new attempt
      currentAttempt = assignment.currentAttempt + 1;
      preExamCompleted = true; // 2+ denemede ön sınav atlanır
      videosCompleted = false; // videolar sıfırdan izlenmeli
      postExamCompleted = false; // son sınav tekrar girilmeli
    } else if (isExpiredRetryable) {
      // Cron expired etti ama personelin hâlâ deneme hakkı var. KARAR (2026-05-20):
      // süresi dolan denemenin video/son-sınav ilerlemesi TAŞINMAZ — personel sıfırdan
      // başlar (isRetryPending ile aynı). start route zaten expired attempt'i resume
      // etmeyip yeni attempt açtığı için detay sayfası o davranışla hizalanır. Eski
      // mantık expired attempt'in ilerlemesini okuyup "aşama TAMAM + video %0" çelişkisi
      // yaratıyordu (Devakent ÖZGÜR ÜNVER incident, 2026-05-20).
      currentAttempt = assignment.currentAttempt + 1;
      // requirePreExamOnRetry=false → yeni deneme watching_videos'tan başlar (ön sınav
      // atlanır, 2 adımlı retry). true → pre_exam'dan başlar (3 adımlı normal akış).
      preExamCompleted = t.requirePreExamOnRetry !== true;
      videosCompleted = false;
      postExamCompleted = false;
    } else if (isActive) {
      // Active attempt in progress
      currentAttempt = assignment.currentAttempt;
      const isRetry = latestAttempt.attemptNumber > 1;
      preExamCompleted = isRetry || latestAttempt.preExamCompletedAt !== null;
      // Video completion: PDF içerikler opsiyonel — yalnızca video/ses tamamlanma şartı geçişi belirler
      const attemptVideoProgress = new Map(
        (latestAttempt.videoProgress ?? []).map((vp) => [vp.videoId, vp])
      );
      const requiredVideos = t.videos.filter((v) => v.contentType !== 'pdf');
      videosCompleted =
        requiredVideos.length === 0 ||
        latestAttempt.videosCompletedAt !== null ||
        requiredVideos.every((v) => attemptVideoProgress.get(v.id)?.isCompleted === true);
      // postExamStartedAt çift kontrolü: cron'un legacy verisinde postExamCompletedAt
      // bogus dolu olabilir (started=null ise gerçek tamamlama değildir).
      postExamCompleted =
        latestAttempt.postExamCompletedAt !== null && latestAttempt.postExamStartedAt !== null;
    } else {
      // Passed or all attempts exhausted
      currentAttempt = assignment.currentAttempt;
      preExamCompleted = true;
      videosCompleted = true;
      postExamCompleted = true; // Tüm süreç bitti (geçti veya haklar tükendi)
    }

    // ═══ VIDEO LIST — always use active/latest non-completed attempt's progress ═══
    const activeAttemptForVideos = isRetryPending ? null : isActive ? latestAttempt : null;
    const videoProgressMap = new Map(
      (activeAttemptForVideos?.videoProgress ?? []).map((vp) => [vp.videoId, vp])
    );

    // Pre-exam score: only meaningful if this is a retry (attempt > 1).
    // Fetch the first attempt's score separately to avoid pulling all history.
    const firstAttemptData =
      latestAttempt && latestAttempt.attemptNumber > 1
        ? await prisma.examAttempt.findFirst({
            where: { assignmentId: assignment.id, attemptNumber: 1 },
            select: { preExamScore: true },
          })
        : (latestAttempt ?? null);
    const preExamScore = firstAttemptData?.preExamScore
      ? Number(firstAttemptData.preExamScore)
      : undefined;

    // Son deneme puanı (retry banner'da gösterilecek)
    const lastAttemptScore = latestAttempt?.postExamScore
      ? Number(latestAttempt.postExamScore)
      : undefined;

    // Henüz açılmamış mı? Başlangıç tarihi gelmemişse personel detayda
    // "Başla" butonu disabled olur ve banner gösterilir.
    const isNotStarted = t.startDate ? new Date() < new Date(t.startDate) : false;

    return jsonResponse(
      {
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
        startDate: t.startDate
          ? t.startDate.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : null,
        deadline: t.endDate
          ? t.endDate.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '',
        preExamScore,
        lastAttemptScore,
        examOnly: t.examOnly === true,
        // Soru sayısı — liste endpoint'i (MyTrainingItem.questionCount) ile tutarlı.
        // Mobil sınav-öncesi bilgilendirme ekranında gösterir.
        questionCount: t._count.questions,
        // SCORM tespiti — mobil bu eğitimi normal video/exam akışı yerine indir-ve-oynat
        // WebView oynatıcısına yönlendirmek için kullanır (web kullanmaz, additive).
        isScorm: t.scormEntryPoint != null,
        scormEntryPoint: t.scormEntryPoint ?? null,
        isExpired,
        isNotStarted,
        preExamCompleted,
        videosCompleted,
        postExamCompleted,
        // needsRetry: frontend retry-flow (pre-exam atla, 2-step) için bayrak.
        // isExpiredRetryable'da preExamCompleted = (requirePreExamOnRetry !== true) olduğu
        // için bu formül: requirePreExamOnRetry=false → needsRetry=true (2-step retry),
        // true → needsRetry=false (3-step normal akış, ön sınav baştan izlenir).
        needsRetry: isRetryPending || (isExpiredRetryable && preExamCompleted),
        // Banner ayrımı için: isRetryPending = "kullanıcı sınavdan kaldı, yeni deneme bekliyor",
        // isExpiredRetryable = "süre doldu, cron expire etti, hâlâ deneme hakkı var" — farklı UX mesajları.
        isExpiredRetryable,
        // EY.FR.40 — detay sayfasındaki "Geri Bildirim" bölümü için.
        feedback: {
          formActive: feedbackFormActive,
          mandatory: t.feedbackMandatory === true,
          submitted: feedbackSubmitted,
          submittedAt: priorFeedback?.submittedAt
            ? priorFeedback.submittedAt.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : null,
          canSubmit: feedbackFormActive && !feedbackSubmitted && triggeringAttempt != null,
          attemptId: triggeringAttempt?.id ?? null,
        },
        videos: t.videos.map((v) => ({
          id: v.id,
          title: v.title,
          duration: `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, '0')}`,
          completed: isRetryPending ? false : (videoProgressMap.get(v.id)?.isCompleted ?? false),
        })),
      },
      200,
      // N4 FIX (Haziran 2026): aktif (devam eden) attempt varken cache YASAK.
      // max-age=15 + swr=30 ile, ön sınavı yeni bitirip detaya dönen personel
      // ~45 sn boyunca bayat "preExamCompleted:false" görüyor ve CTA tekrar
      // "Ön Sınava Başla" diyordu (şikayet a'nın ikinci mekanizması). Akış
      // ilerlerken tazelik > performans; attempt yokken eski cache kalır.
      {
        'Cache-Control': isActive
          ? 'private, no-store'
          : 'private, max-age=15, stale-while-revalidate=30',
      }
    );
  },
  { requireOrganization: true }
);
