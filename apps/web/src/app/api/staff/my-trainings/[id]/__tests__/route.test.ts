import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Staff My-Trainings Detail — step completion + needsRetry sözleşmesi.
 *
 * **KÖK NEDEN** (2026-05-20 Devakent ÖZGÜR ÜNVER incident):
 * `isExpiredRetryable` durumu (cron attempt'i expire etti, hak kaldı) süresi dolan
 * denemenin ilerlemesini okuyordu → aşama "TAMAM" görünürken video listesi "%0"
 * gösteriyordu (üç katman üç farklı yanıt veriyordu).
 *
 * **KARAR:** `isExpiredRetryable` artık `isRetryPending` ile aynı — temiz retry.
 * Süresi dolan denemenin video/son-sınav ilerlemesi TAŞINMAZ; personel sıfırdan
 * başlar. Bu, start route'un zaten yaptığı "yeni attempt aç" davranışıyla hizalanır.
 *
 * Bu test serisi yeni sözleşmeyi doğrular: expired-retryable durumda videos/post
 * her zaman false, preExamCompleted yalnızca requirePreExamOnRetry'e bağlı.
 */

const { prismaMock, isEndDatePassedMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: {
      findFirst: vi.fn(),
    },
    examAttempt: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      // preExamGenuinelyDone hesabı: ön testi gerçekten tamamlamış (started+completed) attempt
      // sayısı. Base 0 → "ön test hiç verilmemiş"; retry-skip senaryoları per-test 1 verir.
      count: vi.fn().mockResolvedValue(0),
    },
    // EY.FR.40 geri bildirim — route Promise.all içinde her zaman çağırır.
    // Base mock'lar null/[] döner → feedback.formActive=false (mevcut testler etkilenmez).
    trainingFeedbackForm: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    trainingFeedbackResponse: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
  isEndDatePassedMock: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn() }));
vi.mock('@/lib/date-helpers', () => ({
  isEndDatePassed: isEndDatePassedMock,
  toEndOfDayUTC: (d: Date | string) => new Date(d),
}));

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(
    handler: (ctx: {
      params: Promise<P>;
      dbUser: { id: string; role: string; organizationId: string };
      organizationId: string;
    }) => Promise<Response>
  ) => {
    return async (_request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        params: Promise.resolve(await params),
        dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
        organizationId: 'org-1',
      });
    };
  },
}));

import { GET } from '../route';

const ASSIGNMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function detailRequest(): Request {
  return new Request(`http://localhost/api/staff/my-trainings/${ASSIGNMENT_ID}`);
}

function makeAssignment(
  latestAttemptOverrides: Record<string, unknown> = {},
  extra: {
    feedbackMandatory?: boolean;
    originalMaxAttempts?: number;
    requirePreExamOnRetry?: boolean;
    questionCount?: number;
  } = {}
) {
  return {
    id: ASSIGNMENT_ID,
    userId: 'staff-1',
    status: 'in_progress',
    currentAttempt: 1,
    maxAttempts: 3,
    originalMaxAttempts: extra.originalMaxAttempts ?? 3,
    dueDate: null,
    training: {
      id: 'training-1',
      title: 'Test Eğitim',
      description: '',
      category: 'test',
      passingScore: 70,
      examDurationMinutes: 30,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-20'),
      examOnly: false,
      requirePreExamOnRetry: extra.requirePreExamOnRetry ?? false,
      feedbackMandatory: extra.feedbackMandatory ?? false,
      videos: [
        {
          id: 'video-1',
          title: 'Video 1',
          durationSeconds: 300,
          sortOrder: 0,
          contentType: 'video',
        },
      ],
      _count: { questions: extra.questionCount ?? 12 },
    },
    examAttempts: [
      {
        attemptNumber: 1,
        status: 'expired',
        isPassed: false,
        preExamScore: null,
        postExamScore: 0,
        preExamCompletedAt: null,
        videosCompletedAt: null,
        postExamStartedAt: null,
        postExamCompletedAt: new Date('2026-05-17T03:24:44Z'),
        videoProgress: [],
        ...latestAttemptOverrides,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isEndDatePassedMock.mockReturnValue(false);
});

describe('Staff my-trainings detail — isExpiredRetryable temiz-retry sözleşmesi', () => {
  it("expired + requirePreExamOnRetry=false → preExam true (retry'da atlanır), videos/post false, needsRetry true", async () => {
    // Süresi dolan denemede video tamamlanmış OLSA bile (videosCompletedAt + isCompleted dolu)
    // ilerleme TAŞINMAZ — yeni deneme sıfırdan başlar.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment(
        {
          preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
          preExamScore: 70,
          videosCompletedAt: new Date('2026-05-15T10:00:00Z'),
          videoProgress: [{ videoId: 'video-1', isCompleted: true }],
        },
        { requirePreExamOnRetry: false }
      )
    );
    // Ön test GERÇEKTEN tamamlanmış (started+completed) → genuine retry, atlama meşru.
    prismaMock.examAttempt.count.mockResolvedValueOnce(1);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Retry'da ön sınav atlanır → preExamCompleted=true. Videolar/son sınav SIFIRDAN.
    expect(body.preExamCompleted).toBe(true);
    expect(body.videosCompleted).toBe(false);
    expect(body.postExamCompleted).toBe(false);
    expect(body.isExpiredRetryable).toBe(true);
    // 2-step retry akışı (Videoları İzle CTA)
    expect(body.needsRetry).toBe(true);
    // Yeni deneme numarası: assignment.currentAttempt(1) + 1
    expect(body.currentAttempt).toBe(2);
  });

  it('expired — eski denemenin tamamlanmış video ilerlemesi video listesine SIZMAZ (aşama/%0 çelişkisi yok)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment(
        {
          preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
          videosCompletedAt: new Date('2026-05-15T10:00:00Z'),
          videoProgress: [{ videoId: 'video-1', isCompleted: true }],
        },
        { requirePreExamOnRetry: false }
      )
    );

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    // KRİTİK: video listesindeki HER video completed:false — aksi halde detay sayfası
    // "AŞAMA TAMAM" + "%0 TAMAMLANDI" çelişkisini gösterir.
    expect(body.videos).toHaveLength(1);
    expect(body.videos.every((v: { completed: boolean }) => v.completed === false)).toBe(true);
    expect(body.videosCompleted).toBe(false);
  });

  it('expired + requirePreExamOnRetry=true → preExam false (baştan), videos/post false, needsRetry false (3-step)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment(
        {
          preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
          preExamScore: 70,
          videoProgress: [{ videoId: 'video-1', isCompleted: true }],
        },
        { requirePreExamOnRetry: true }
      )
    );
    // Ön test gerçekten tamamlanmış olsa bile requirePreExamOnRetry=true → yine baştan.
    prismaMock.examAttempt.count.mockResolvedValueOnce(1);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    // requirePreExamOnRetry=true → yeni deneme pre_exam'dan başlar, 3-step normal akış
    expect(body.preExamCompleted).toBe(false);
    expect(body.videosCompleted).toBe(false);
    expect(body.postExamCompleted).toBe(false);
    expect(body.isExpiredRetryable).toBe(true);
    expect(body.needsRetry).toBe(false);
  });

  it("expired + ön test HİÇ tamamlanmadı (count=0) → preExam FALSE (retry'da baştan verilir), needsRetry false", async () => {
    // 2026-06 düzeltme: ilk denemesi ön testteyken expire/timeout olan personel ön testi
    // hiç vermemiştir (preExamCompletedAt NULL). Eskiden requirePreExamOnRetry=false olduğu
    // için preExamCompleted=true sayılıp videoya atlanıyordu. Artık genuine tamamlanma yoksa
    // (count=0) ön test baştan istenir.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment(
        { status: 'expired', preExamCompletedAt: null, preExamScore: null },
        { requirePreExamOnRetry: false }
      )
    );
    // count base mock 0 → ön test gerçekten tamamlanmamış.

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.isExpiredRetryable).toBe(true);
    expect(body.preExamCompleted).toBe(false); // KRİTİK: ön test baştan verilmeli
    expect(body.needsRetry).toBe(false); // 2-step (pre-exam atla) DEĞİL
  });

  it('retry-pending (son testten kaldı) ama ön test HİÇ tamamlanmadı (count=0) → preExam FALSE', async () => {
    // İlk denemesi ön testteyken TIMEOUT olup completed+failed olan personel: son testi
    // "geçemedi" görünür ama ön testi hiç vermemiştir. Retry'da ön test baştan istenmeli.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment(
        { status: 'completed', isPassed: false, preExamCompletedAt: null, preExamScore: null },
        { requirePreExamOnRetry: false }
      )
    );
    // count base mock 0 → ön test gerçekten tamamlanmamış.

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.preExamCompleted).toBe(false); // KRİTİK
    // needsRetry yine true (yeni attempt POST /start ile açılmalı; start route pre_exam döner)
    expect(body.needsRetry).toBe(true);
  });

  it('expired + eğitim süresi GERÇEKTEN dolmuş (effectiveDueDate geçmiş) → isExpiredRetryable false', async () => {
    // start route bu durumda 403 döner; detay "tekrar dene" CTA'sı göstermemeli.
    isEndDatePassedMock.mockReturnValue(true);
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({
        preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
      })
    );

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.isExpiredRetryable).toBe(false);
    expect(body.isExpired).toBe(true);
  });

  it("active watching_videos attempt (revive sonrası) → expected aktif flag'ler", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({
        status: 'watching_videos',
        preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
        preExamScore: 70,
        videosCompletedAt: null,
        postExamCompletedAt: null,
        postExamScore: null,
        postExamStartedAt: null,
        videoProgress: [{ videoId: 'video-1', isCompleted: false }],
      })
    );

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.preExamCompleted).toBe(true);
    expect(body.videosCompleted).toBe(false);
    expect(body.postExamCompleted).toBe(false);
    expect(body.isExpiredRetryable).toBe(false);
    expect(body.needsRetry).toBe(false);
  });

  it('postExamCompletedAt set + postExamStartedAt null (legacy bogus data) → postExamCompleted FALSE', async () => {
    // Defansif kontrol: yeni cron BUG-1 fix sonrası bu durum oluşmaz, ama eski
    // DB satırlarında hâlâ bogus completedAt var. Çift kontrol bu satırlarda da çalışmalı.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({
        status: 'watching_videos',
        preExamCompletedAt: new Date('2026-05-14T06:42:18Z'),
        postExamStartedAt: null,
        postExamCompletedAt: new Date('2026-05-17T03:24:44Z'), // bogus cron yazımı
        postExamScore: 0,
        videoProgress: [{ videoId: 'video-1', isCompleted: true }],
        videosCompletedAt: new Date(),
      })
    );

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    // Bogus completedAt dolu ama startedAt null → completion sayılmaz
    expect(body.postExamCompleted).toBe(false);
  });
});

describe('Staff my-trainings detail — geri bildirim (EY.FR.40) bölümü', () => {
  it("org'da aktif form yok → feedback.formActive false (durum d, kart gizli)", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment());
    // trainingFeedbackForm.findFirst → base mock null

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.feedback.formActive).toBe(false);
    expect(body.feedback.canSubmit).toBe(false);
    expect(body.feedback.submitted).toBe(false);
  });

  it('aktif form + tamamlanmış deneme yok → canSubmit false, attemptId null (durum c)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment());
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });
    // examAttempt.findMany → base mock []

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.formActive).toBe(true);
    expect(body.feedback.canSubmit).toBe(false);
    expect(body.feedback.attemptId).toBeNull();
    expect(body.feedback.submitted).toBe(false);
  });

  it('aktif form + tetikleyen passed deneme → canSubmit true, attemptId doğru (durum b)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment());
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-2', status: 'completed', isPassed: true, attemptNumber: 2 },
    ]);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.canSubmit).toBe(true);
    expect(body.feedback.attemptId).toBe('attempt-2');
  });

  it('bu eğitim için önceki geri bildirim var → submitted true, submittedAt formatlı, canSubmit false (durum a)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(makeAssignment());
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });
    prismaMock.trainingFeedbackResponse.findFirst.mockResolvedValueOnce({
      submittedAt: new Date('2026-05-18T09:00:00Z'),
    });
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-1', status: 'completed', isPassed: true, attemptNumber: 1 },
    ]);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.submitted).toBe(true);
    expect(body.feedback.submittedAt).toBe('18.05.2026');
    // Zaten gönderilmişse tekrar doldurulamaz.
    expect(body.feedback.canSubmit).toBe(false);
  });

  it('feedbackMandatory true → feedback.mandatory true', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { feedbackMandatory: true })
    );
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.mandatory).toBe(true);
  });

  it('cycle dışı deneme (attemptNumber > originalMaxAttempts) atlanır, ilk tetikleyen seçilir', async () => {
    // attempt-4: cycle dışı (4 > 3) → tetiklenmez. attempt-2: passed, cycle içi → tetiklenir.
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { originalMaxAttempts: 3 })
    );
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-4', status: 'completed', isPassed: false, attemptNumber: 4 },
      { id: 'attempt-2', status: 'completed', isPassed: true, attemptNumber: 2 },
    ]);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.canSubmit).toBe(true);
    expect(body.feedback.attemptId).toBe('attempt-2');
  });

  it('ara başarısız deneme (attemptNumber < originalMaxAttempts) tetiklemez → canSubmit false', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { originalMaxAttempts: 3 })
    );
    prismaMock.trainingFeedbackForm.findFirst.mockResolvedValueOnce({ id: 'form-1' });
    prismaMock.examAttempt.findMany.mockResolvedValueOnce([
      { id: 'attempt-1', status: 'completed', isPassed: false, attemptNumber: 1 },
    ]);

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    const body = await res.json();

    expect(body.feedback.canSubmit).toBe(false);
    expect(body.feedback.attemptId).toBeNull();
  });
});

/**
 * questionCount — detay yanıtı liste endpoint'i (MyTrainingItem.questionCount) ile
 * tutarlı olmalı. Mobil, sınav-öncesi bilgilendirme ekranında soru sayısını burada
 * okur; questions endpoint'i faz koruması yüzünden sınav başlamadan 403 verir.
 */
describe('Staff my-trainings detail — questionCount yanıt alanı', () => {
  it('training._count.questions değerini döner', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValueOnce(
      makeAssignment({}, { questionCount: 25 })
    );

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questionCount).toBe(25);
  });
});

/**
 * N1 round determinizm kilidi: id (assignmentId) ile bulunamazsa trainingId fallback'i
 * EN YENİ round'u deterministik seçmeli (resolveExamFlowState ile aynı sıralama). orderBy
 * olmadan eski round seçilip exam-flow ile çelişen aşama gösterilebiliyordu (N1 sınıfı).
 */
describe('Staff my-trainings detail — trainingId fallback round sıralaması', () => {
  it('assignmentId miss → trainingId fallback orderBy [{round:desc},{assignedAt:desc}] ile çağrılır', async () => {
    prismaMock.trainingAssignment.findFirst
      .mockResolvedValueOnce(null) // 1) assignmentId branch — bulunamadı
      .mockResolvedValueOnce(makeAssignment()); // 2) trainingId fallback — bulundu

    const res = await GET(detailRequest(), { params: Promise.resolve({ id: ASSIGNMENT_ID }) });
    expect(res.status).toBe(200);

    // İkinci (fallback) çağrı resolver sıralamasıyla yapılmalı.
    const fallbackCall = prismaMock.trainingAssignment.findFirst.mock.calls[1][0] as {
      where: { trainingId: string };
      orderBy: unknown;
    };
    expect(fallbackCall.where.trainingId).toBe(ASSIGNMENT_ID);
    expect(fallbackCall.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }]);
  });
});
