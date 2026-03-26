'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Play, Award, CheckCircle, ArrowRight, Clock } from 'lucide-react';

const COUNTDOWN_SECONDS = 60;

function TransitionContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const from = searchParams.get('from') ?? 'pre';
  const score = searchParams.get('score');
  const passed = searchParams.get('passed');
  const passingScore = searchParams.get('passingScore');

  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);

  // Determine type
  const isPreToVideos = from === 'pre' || from === 'pre-exam';
  const isVideosToPost = from === 'videos';
  const isPostResult = from === 'post-exam';

  const destination = isPreToVideos
    ? `/exam/${id}/videos`
    : isVideosToPost
      ? `/exam/${id}/post-exam`
      : '/staff/my-trainings';

  const shouldCountdown = !isPostResult;

  const navigate = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    router.push(destination);
  };

  useEffect(() => {
    if (!shouldCountdown) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          navigate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ POST-EXAM RESULT SCREEN ═══
  if (isPostResult) {
    const isPassed = passed === 'true';
    const scoreNum = Number(score ?? 0);
    const passingNum = Number(passingScore ?? 70);

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{
        background: isPassed
          ? 'linear-gradient(135deg, #059669, #064e3b)'
          : 'linear-gradient(135deg, #991b1b, #450a0a)',
      }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div className="px-8 pt-8 pb-6 text-center" style={{
            background: isPassed
              ? 'linear-gradient(135deg, #059669, #047857)'
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
              <div className="h-full rounded-full transition-all duration-1000" style={{
                width: `${scoreNum}%`,
                background: isPassed ? 'linear-gradient(90deg, #059669, #34d399)' : 'linear-gradient(90deg, #dc2626, #f87171)',
              }} />
            </div>

            {!isPassed && (
              <div className="rounded-xl p-4" style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                  Bir sonraki denemenizde tekrar deneyebilirsiniz.
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  2. denemeden itibaren ön sınav atlanır, doğrudan videoları izleyip son sınava girersiniz.
                </p>
              </div>
            )}

            <button
              onClick={() => router.push('/staff/my-trainings')}
              className="w-full flex items-center justify-center gap-2 rounded-xl h-12 text-[14px] font-semibold text-white"
              style={{
                background: isPassed ? 'linear-gradient(135deg, var(--color-primary), #065f46)' : 'linear-gradient(135deg, #475569, #334155)',
              }}
            >
              Eğitimlerime Dön
            </button>
          </div>
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
      background: 'linear-gradient(135deg, var(--color-primary), #064e3b)',
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), #064e3b)' }}><span className="text-white">Yükleniyor...</span></div>}>
      <TransitionContent />
    </Suspense>
  );
}
