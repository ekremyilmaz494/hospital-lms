'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Video, FileQuestion, CheckCircle, Clock, Play, Target,
  Calendar, BookOpen, Award, ChevronRight, Lock, AlertTriangle,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch, clearFetchCache } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface TrainingVideo {
  title: string;
  duration: string;
  completed: boolean;
}

interface TrainingDetail {
  id: string;
  assignmentId: string;
  title: string;
  category: string;
  description: string;
  passingScore: number;
  maxAttempts: number;
  examDuration: number;
  status: string;
  currentAttempt: number;
  deadline: string;
  videos: TrainingVideo[];
  preExamScore?: number;
  lastAttemptScore?: number;
  examOnly?: boolean;
  isExpired?: boolean;
  preExamCompleted: boolean;
  videosCompleted: boolean;
  postExamCompleted: boolean;
  needsRetry?: boolean;
}

export default function TrainingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;

  const apiUrl = id ? `/api/staff/my-trainings/${id}` : null;

  // Clear stale cache synchronously during render — exam state changes between attempts.
  // Doing this in useEffect would be too late: useFetch's own useEffect fires first (hooks
  // run in registration order), causing it to read the stale cached value before we clear it.
  const cacheCleared = useRef(false);
  if (!cacheCleared.current && apiUrl) {
    cacheCleared.current = true;
    clearFetchCache(apiUrl);
  }

  const { data: training, isLoading, error, refetch } = useFetch<TrainingDetail>(apiUrl);

  // Auto-retry once when assignment lookup fails on first load (timing edge case)
  const retried = useRef(false);
  useEffect(() => {
    if (error === 'Eğitim ataması bulunamadı' && !retried.current) {
      retried.current = true;
      const t = setTimeout(() => refetch(), 500);
      return () => clearTimeout(t);
    }
  }, [error, refetch]);

  if (isLoading) return <PageLoading />;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="text-sm" style={{ color: 'var(--color-error)' }}>
        {error === 'Eğitim ataması bulunamadı' || error.includes('not found') || error.includes('404')
          ? 'Bu eğitime erişim yetkiniz yok veya eğitim bulunamadı.'
          : error}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/staff/my-trainings" className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
          ← Eğitimlerime Dön
        </Link>
        <button
          onClick={refetch}
          className="text-sm font-semibold"
          style={{ color: 'var(--color-primary)' }}
        >
          ↻ Tekrar Dene
        </button>
      </div>
    </div>
  );
  if (!training) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Eğitim bulunamadı</div></div>;

  const videos = training.videos ?? [];
  const completedVideos = videos.filter(v => v.completed).length;
  const videoProgress = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

  const isExamOnly = training.examOnly === true;
  // 2+ denemelerde ön sınav atlanır (needsRetry = retry bekliyor, henüz start çağrılmamış)
  const isRetry = !isExamOnly && ((training.currentAttempt ?? 0) > 1 || !!training.needsRetry);

  // Current step index
  // examOnly: 0=Son Sınav, 1=done
  // Retry: 0=Video, 1=Son Sınav, 2=done
  // Normal: 0=Ön Sınav, 1=Video, 2=Son Sınav, 3=done
  const currentStep = isExamOnly
    ? (!training.postExamCompleted ? 0 : 1)
    : isRetry
      ? (!training.videosCompleted ? 0 : !training.postExamCompleted ? 1 : 2)
      : (!training.preExamCompleted ? 0 : !training.videosCompleted ? 1 : !training.postExamCompleted ? 2 : 3);
  const totalSteps = isExamOnly ? 1 : isRetry ? 2 : 3;
  const completedSteps = currentStep;
  const overallProgress = Math.round((completedSteps / totalSteps) * 100);
  const allDone = isExamOnly ? currentStep >= 1 : isRetry ? currentStep >= 2 : currentStep >= 3;

  // CTA
  const examId = training.assignmentId || training.id;
  let ctaHref = `/exam/${examId}/post-exam`;
  let ctaLabel = 'Sınava Başla';
  let ctaIcon: typeof Play = Award;
  if (isExamOnly) {
    ctaHref = `/exam/${examId}/post-exam`; ctaLabel = 'Sınava Başla'; ctaIcon = Award;
  } else if (isRetry) {
    if (currentStep === 0) { ctaHref = `/exam/${examId}/videos`; ctaLabel = 'Videoları İzle'; ctaIcon = Play; }
    else if (currentStep === 1) { ctaHref = `/exam/${examId}/post-exam`; ctaLabel = 'Son Sınava Başla'; ctaIcon = Award; }
  } else {
    if (currentStep === 0) { ctaHref = `/exam/${examId}/pre-exam`; ctaLabel = 'Ön Sınava Başla'; ctaIcon = FileQuestion; }
    else if (currentStep === 1) { ctaHref = `/exam/${examId}/videos`; ctaLabel = 'Videoları İzle'; ctaIcon = Play; }
    else if (currentStep === 2) { ctaHref = `/exam/${examId}/post-exam`; ctaLabel = 'Son Sınava Başla'; ctaIcon = Award; }
  }

  const steps = isExamOnly
    ? [
        { label: 'Sınav', desc: 'Değerlendirme sınavı', icon: Award, done: training.postExamCompleted },
      ]
    : isRetry
    ? [
        { label: 'Eğitim Videoları', desc: `${videos.length} video`, icon: Video, done: training.videosCompleted },
        { label: 'Son Sınav', desc: 'Değerlendirme sınavı', icon: Award, done: training.postExamCompleted },
      ]
    : [
        { label: 'Ön Sınav', desc: 'Bilgi seviyesi testi', icon: FileQuestion, done: training.preExamCompleted, score: training.preExamScore },
        { label: 'Eğitim Videoları', desc: `${videos.length} video`, icon: Video, done: training.videosCompleted },
        { label: 'Son Sınav', desc: 'Değerlendirme sınavı', icon: Award, done: training.postExamCompleted },
      ];

  const CtaIcon = ctaIcon;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <BlurFade delay={0}>
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), #064e3b)', boxShadow: '0 8px 32px rgba(13, 150, 104, 0.2)' }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(-20%, 20%)' }} />

          <div className="relative px-4 py-5 sm:px-8 sm:py-7">
            {/* Top row */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => router.back()} className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-white" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fcd34d' }}>
                  {training.category || 'Eğitim'}
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {training.title}
            </h1>
            {training.description && (
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>{training.description}</p>
            )}

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { icon: Target, text: `Deneme ${Math.max(training.currentAttempt ?? 0, 1)}/${training.maxAttempts ?? 3}` },
                { icon: Calendar, text: training.deadline },
                { icon: Clock, text: `${training.examDuration ?? 30} dk sınav` },
                { icon: Award, text: `Geçme: ${training.passingScore ?? 70}` },
              ].filter(c => c.text).map((chip, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                  <chip.icon className="h-3 w-3" /> {chip.text}
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallProgress}%`, background: 'rgba(255,255,255,0.75)' }} />
              </div>
              <span className="text-[11px] font-bold font-mono text-white/80">{completedSteps}/{totalSteps}</span>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Expired banner */}
      {training.isExpired && !allDone && (
        <BlurFade delay={0.03}>
          <div
            className="mt-4 flex items-center gap-3 rounded-xl px-5 py-3"
            style={{ background: 'var(--color-error-bg)', border: '1px solid rgba(220, 38, 38, 0.2)' }}
          >
            <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-error)' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-error)' }}>
                Bu eğitimin süresi dolmuş
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Eğitim süresi {training.deadline} tarihinde sona erdi. Sınava giriş yapılamaz.
              </p>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Retry banner — only when not failed */}
      {isRetry && training.status !== 'failed' && !training.isExpired && (
        <BlurFade delay={0.03}>
          <div
            className="mt-4 flex items-center gap-3 rounded-xl px-5 py-3"
            style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
          >
            <span className="text-lg">🔄</span>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                {training.currentAttempt}. Deneme Hakkındasınız
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {training.lastAttemptScore !== undefined && `Önceki deneme puanı: %${training.lastAttemptScore}. `}
                Ön sınav atlandı. Videoları izleyip son sınava girebilirsiniz. (Toplam {training.maxAttempts} hak)
              </p>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Steps */}
      <BlurFade delay={0.05}>
        <div className="mt-6 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {steps.map((step, idx) => {
              const isCurrent = idx === currentStep;
              const isDone = step.done;
              const isLocked = idx > currentStep;
              return (
                <div key={idx} className="flex items-center flex-1 gap-2">
                  <div
                    className="flex-1 rounded-xl border p-4 transition-all duration-200"
                    style={{
                      background: isDone ? 'var(--color-success-bg)' : isCurrent ? 'var(--color-surface)' : 'var(--color-bg)',
                      borderColor: isDone ? 'var(--color-success)' : isCurrent ? 'var(--color-primary)' : 'var(--color-border)',
                      borderWidth: isCurrent ? '2px' : '1px',
                      opacity: isLocked ? 0.5 : 1,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: isDone ? 'var(--color-success)' : isCurrent ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle className="h-5 w-5 text-white" />
                        ) : isLocked ? (
                          <Lock className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                        ) : (
                          <step.icon className="h-5 w-5" style={{ color: isCurrent ? 'white' : 'var(--color-text-muted)' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold truncate">{step.label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{step.desc}</p>
                        {step.score !== undefined && isDone && (
                          <p className="text-[10px] font-bold font-mono mt-0.5" style={{ color: 'var(--color-success)' }}>Puan: {step.score}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="hidden sm:block h-4 w-4 shrink-0" style={{ color: isDone ? 'var(--color-success)' : 'var(--color-border)' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Video section — show after pre-exam, or immediately on retry (ön sınav atlanır). Hide when failed. */}
      {(training.preExamCompleted || isRetry) && videos.length > 0 && !allDone && (
        <BlurFade delay={0.1}>
          <div
            className="rounded-2xl border p-6 mb-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold">Eğitim Videoları</h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{completedVideos}/{videos.length} tamamlandı</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-24 rounded-full" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${videoProgress}%`, background: videoProgress === 100 ? 'var(--color-success)' : 'var(--color-primary)' }} />
                </div>
                <span className="text-[12px] font-bold font-mono" style={{ color: videoProgress === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{videoProgress}%</span>
              </div>
            </div>

            <div className="space-y-2">
              {videos.map((v, i) => {
                const isNext = !v.completed && i === completedVideos;
                const isLocked = !v.completed && !isNext;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-xl p-4 transition-all duration-200"
                    style={{
                      background: v.completed ? 'var(--color-success-bg)' : isNext ? 'var(--color-primary-light)' : 'transparent',
                      border: `1px solid ${v.completed ? 'rgba(5,150,105,0.2)' : isNext ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      opacity: isLocked ? 0.45 : 1,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                      style={{
                        background: v.completed ? 'var(--color-success)' : isNext ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                        color: v.completed || isNext ? 'white' : 'var(--color-text-muted)',
                      }}
                    >
                      {v.completed ? <CheckCircle className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{v.title}</p>
                      <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock className="h-3 w-3" /> {v.duration}
                      </p>
                    </div>
                    {v.completed && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--color-success)', color: 'white' }}>Tamamlandı</span>
                    )}
                    {isNext && (
                      <Link href={`/exam/${examId}/videos`}>
                        <div className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                          <Play className="h-3.5 w-3.5" /> İzle
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {training.videosCompleted && !training.postExamCompleted && (
              <div className="mt-5 pt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl p-4" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-warning-bg)' }}>
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
                  <div>
                    <p className="text-[13px] font-bold">Tüm videolar tamamlandı!</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Son sınava geçebilirsiniz</p>
                  </div>
                </div>
                <Link href={`/exam/${examId}/post-exam`}>
                  <div className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-white" style={{ background: 'var(--color-warning)' }}>
                    Son Sınav <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </div>
            )}
          </div>
        </BlurFade>
      )}

      {/* CTA */}
      {!allDone && !training.isExpired && (
        <BlurFade delay={0.15}>
          <Link href={ctaHref} className="block">
            <div
              className="flex items-center justify-center gap-3 rounded-2xl py-4 text-[15px] font-semibold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] w-full"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 6px 20px rgba(13, 150, 104, 0.3)',
              }}
            >
              <CtaIcon className="h-5 w-5" />
              {ctaLabel}
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </div>
          </Link>
        </BlurFade>
      )}

      {/* Completed state — passed */}
      {allDone && training.status === 'passed' && (
        <BlurFade delay={0.15}>
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
            </div>
            <p className="text-[15px] font-bold" style={{ color: 'var(--color-success)' }}>Eğitim Tamamlandı!</p>
            <Link href="/staff/certificates" className="text-[12px] font-semibold" style={{ color: 'var(--color-primary)' }}>
              Sertifikalarıma Git →
            </Link>
          </div>
        </BlurFade>
      )}

      {/* Failed state — all attempts exhausted */}
      {allDone && training.status === 'failed' && (
        <BlurFade delay={0.15}>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--color-error-bg)' }}>
              <Lock className="h-8 w-8" style={{ color: 'var(--color-error)' }} />
            </div>
            <p className="text-[15px] font-bold" style={{ color: 'var(--color-error)' }}>Tüm Deneme Hakları Tükendi</p>
            <p className="text-[12px] text-center max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
              {training.maxAttempts} deneme hakkınızın tamamını kullandınız. Ek deneme hakkı için eğitim yöneticinize başvurun.
            </p>
            <Link href="/staff/my-trainings" className="text-[12px] font-semibold" style={{ color: 'var(--color-primary)' }}>
              ← Eğitimlerime Dön
            </Link>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
