'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Play, Award, CheckCircle, ArrowRight, Clock, Check, X } from 'lucide-react';

interface QuestionResult {
  questionText: string;
  selectedOptionText: string | null;
  correctOptionText: string | null;
  isCorrect: boolean;
}

const COUNTDOWN_SECONDS = 60;

function TransitionContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const from = searchParams.get('from') ?? 'pre';
  const score = searchParams.get('score');
  const passed = searchParams.get('passed');
  const passingScore = searchParams.get('passingScore');
  const attemptsRemaining = Number(searchParams.get('attemptsRemaining') ?? '0');
  const attemptIdParam = searchParams.get('attemptId');
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [feedbackRequired, setFeedbackRequired] = useState(false);
  const [feedbackMandatory, setFeedbackMandatory] = useState(false);

  // Determine type
  const isPreToVideos = from === 'pre' || from === 'pre-exam';
  const isVideosToPost = from === 'videos';
  const isPostResult = from === 'post-exam';

  const destination = isPreToVideos
    ? `/exam/${id}/videos`
    : isVideosToPost
      ? `/exam/${id}/post-exam`
      : '/staff/my-trainings';

  // examOnly guard: pre→videos geçişinde examOnly ise post-exam'e yönlendir
  useEffect(() => {
    if (!isPreToVideos) return;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(res => res.json())
      .then(attempt => {
        if (attempt?.examOnly) {
          router.replace(`/exam/${id}/post-exam`);
        }
      })
      .catch(() => {});
  }, [id, isPreToVideos, router]);

  const shouldCountdown = !isPostResult;

  const navigate = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace(destination);
  };

  useEffect(() => {
    if (!shouldCountdown) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // navigate() burada çağırma — render sırasında router.push() React hatası verir.
          // Bunun yerine 0'a düşünce ayrı bir effect tetikler.
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [shouldCountdown]);

  // timeLeft 0 olunca navigate et — render dışında, effect içinde güvenli
  useEffect(() => {
    if (timeLeft === 0 && shouldCountdown) {
      navigate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // G7.5 — Load per-question results from sessionStorage (written by post-exam page on submit)
  useEffect(() => {
    if (!isPostResult) return;
    try {
      const stored = sessionStorage.getItem(`exam-results-${id}`);
      if (stored) {
        setQuestionResults(JSON.parse(stored) as QuestionResult[]);
        sessionStorage.removeItem(`exam-results-${id}`);
      }
    } catch { /* ignore */ }
  }, [isPostResult, id]);

  // EY.FR.40 — aktif form var mı ve bu attempt için response gönderilmemiş mi?
  useEffect(() => {
    if (!isPostResult || !attemptIdParam) return;
    let cancelled = false;
    fetch(`/api/feedback/status?attemptId=${attemptIdParam}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        setFeedbackRequired(!!d.feedbackRequired);
        setFeedbackMandatory(!!d.feedbackMandatory);
      })
      .catch(() => { /* sessizce geç, feedbackRequired=false kalır */ });
    return () => { cancelled = true; };
  }, [isPostResult, attemptIdParam]);

  // ═══ POST-EXAM RESULT SCREEN ═══
  if (isPostResult) {
    const isPassed = passed === 'true';
    const scoreNum = Number(score ?? 0);
    const passingNum = Number(passingScore ?? 70);
    const correctCount = questionResults.filter(r => r.isCorrect).length;
    const wrongCount = questionResults.filter(r => !r.isCorrect && r.selectedOptionText !== null).length;
    const skippedCount = questionResults.filter(r => r.selectedOptionText === null).length;

    return (
      <div
        className="min-h-screen overflow-y-auto py-8 px-4"
        style={{
          background: isPassed
            ? 'linear-gradient(135deg, var(--brand-600), var(--brand-900))'
            : 'linear-gradient(135deg, #991b1b, #450a0a)',
        }}
      >
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Score Card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="px-8 pt-8 pb-6 text-center" style={{
              background: isPassed
                ? 'linear-gradient(135deg, var(--brand-600), #047857)'
                : 'linear-gradient(135deg, #dc2626, #991b1b)',
            }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {isPassed ? <CheckCircle className="h-8 w-8 text-white" /> : <Clock className="h-8 w-8 text-white" />}
              </div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {isPassed ? 'Tebrikler! Sınavı Geçtiniz!' : 'Sınav Başarısız'}
              </h2>
              <p className="text-sm text-white/70 mt-1">
                {isPassed ? 'Eğitimi başarıyla tamamladınız.' : 'Baraj puanını geçemediniz.'}
              </p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Puanınız</p>
                  <p className="text-3xl font-bold font-mono" style={{ color: isPassed ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {scoreNum}%
                  </p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Baraj Puanı</p>
                  <p className="text-3xl font-bold font-mono">{passingNum}%</p>
                </div>
              </div>

              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${scoreNum}%`,
                  background: isPassed ? 'linear-gradient(90deg, var(--brand-600), var(--brand-400))' : 'linear-gradient(90deg, #dc2626, #f87171)',
                  transition: 'width 1s ease-out',
                }} />
              </div>

              {/* Correct / Wrong / Skipped summary */}
              {questionResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-success-bg)' }}>
                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-success)' }}>{correctCount}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-success)' }}>Doğru</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-error-bg)' }}>
                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-error)' }}>{wrongCount}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-error)' }}>Yanlış</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg)' }}>
                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-text-muted)' }}>{skippedCount}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Boş</p>
                  </div>
                </div>
              )}

              {!isPassed && attemptsRemaining > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                    {attemptsRemaining} deneme hakkınız kaldı.
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Sonraki denemenizde ön sınav atlanır, doğrudan videoları izleyip son sınava girersiniz.
                  </p>
                </div>
              )}
              {!isPassed && attemptsRemaining === 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--color-error-bg)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--color-error)' }}>
                    Tüm deneme haklarınız tükendi.
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Yeni bir deneme için lütfen yöneticinize başvurun.
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  if (feedbackRequired && attemptIdParam) {
                    router.push(`/exam/${id}/feedback?attemptId=${attemptIdParam}`);
                  } else {
                    router.push('/staff/my-trainings');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl h-12 text-[14px] font-semibold text-white"
                style={{
                  background: isPassed ? 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' : 'linear-gradient(135deg, #475569, #334155)',
                }}
              >
                {feedbackRequired
                  ? (feedbackMandatory ? 'Zorunlu Geri Bildirimi Doldur' : 'Geri Bildirim Ver')
                  : 'Eğitimlerime Dön'}
              </button>
            </div>
          </div>

          {/* Per-question results */}
          {questionResults.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-[14px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Soru Analizi
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {questionResults.length} sorunun cevap dökümü
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {questionResults.map((result, i) => (
                  <div key={i} className="px-6 py-4">
                    {/* Question header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white mt-0.5"
                        style={{
                          background: result.isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                      >
                        {result.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </div>
                      <p className="text-[13px] font-medium leading-snug flex-1" style={{ color: 'var(--color-text-primary)' }}>
                        <span className="font-bold mr-1.5" style={{ color: 'var(--color-text-muted)' }}>{i + 1}.</span>
                        {result.questionText}
                      </p>
                    </div>

                    {/* Answer rows */}
                    <div className="ml-10 space-y-1.5">
                      {result.selectedOptionText && (
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{
                            background: result.isCorrect ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                            border: `1px solid ${result.isCorrect ? 'color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)' : 'rgba(220,38,38,0.2)'}`,
                          }}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color: result.isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {result.isCorrect ? 'Doğru' : 'Verilen'}
                          </span>
                          <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>
                            {result.selectedOptionText}
                          </span>
                        </div>
                      )}

                      {!result.isCorrect && result.correctOptionText && (
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{
                            background: 'var(--color-success-bg)',
                            border: '1px solid color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)',
                          }}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color: 'var(--color-success)' }}>
                            Doğru
                          </span>
                          <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>
                            {result.correctOptionText}
                          </span>
                        </div>
                      )}

                      {result.selectedOptionText === null && (
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                        >
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Boş bırakıldı</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ COUNTDOWN TRANSITION (pre→videos or videos→post) ═══
  const title = isPreToVideos ? 'Ön Sınavınız Tamamlandı!' : 'Tüm Videoları İzlediniz!';
  const subtitle = isPreToVideos ? 'Şimdi eğitim videolarını izleyeceksiniz.' : 'Şimdi son sınava gireceksiniz.';
  const ctaLabel = isPreToVideos ? 'Videolara Geç' : 'Son Sınava Başla';
  const CtaIcon = isPreToVideos ? Play : Award;

  const circumference = 2 * Math.PI * 54;
  const progress = ((COUNTDOWN_SECONDS - timeLeft) / COUNTDOWN_SECONDS) * circumference;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, var(--color-primary), var(--brand-900))',
    }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

      <div className="relative w-full max-w-lg text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <CheckCircle className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        <p className="text-[15px] text-white/70 mb-2">{subtitle}</p>

        {score && (
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <span className="text-[13px] text-white/70">Puanınız:</span>
            <span className="text-[15px] font-bold font-mono text-white">{score}%</span>
          </div>
        )}

        {/* Circular timer */}
        <div className="relative flex items-center justify-center mx-auto mb-8" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r="54" fill="none" strokeWidth="6" stroke="rgba(255,255,255,0.1)" />
            <circle cx="64" cy="64" r="54" fill="none" strokeWidth="6" stroke="rgba(255,255,255,0.8)" strokeLinecap="round"
              strokeDasharray={`${circumference}`} strokeDashoffset={`${circumference - progress}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute text-3xl font-bold font-mono text-white">{timeLeft}</span>
        </div>

        <p className="text-[13px] text-white/50 mb-6">
          {timeLeft > 0 ? `${timeLeft} saniye sonra otomatik geçiş` : 'Yönlendiriliyor...'}
        </p>

        <button
          onClick={navigate}
          className="inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-[15px] font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <CtaIcon className="h-5 w-5" />
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function TransitionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-900))' }}><span className="text-white">Yükleniyor...</span></div>}>
      <TransitionContent />
    </Suspense>
  );
}
