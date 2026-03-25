'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, FileQuestion, CheckCircle, Clock, Play, Target, Calendar, BookOpen, Award, ChevronRight, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShineBorder } from '@/components/ui/shine-border';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface TrainingVideo {
  title: string;
  duration: string;
  completed: boolean;
}

interface TrainingDetail {
  id: string;
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
  preExamCompleted: boolean;
  videosCompleted: boolean;
  postExamCompleted: boolean;
}

export default function TrainingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;

  const { data: training, isLoading, error } = useFetch<TrainingDetail>(id ? `/api/staff/my-trainings/${id}` : null);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!training) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>;
  }

  const videos = training.videos ?? [];
  const completedVideos = videos.filter(v => v.completed).length;
  const videoProgress = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

  // Steps
  const steps = [
    { id: 'pre_exam', label: 'Ön Sınav', sublabel: 'Bilgi seviyesi testi', icon: FileQuestion, completed: training.preExamCompleted ?? false, active: false, score: training.preExamScore },
    { id: 'videos', label: 'Eğitim Videoları', sublabel: `${videos.length} video`, icon: Video, completed: training.videosCompleted ?? false, active: false, progress: `${completedVideos}/${videos.length}` },
    { id: 'post_exam', label: 'Son Sınav', sublabel: 'Değerlendirme sınavı', icon: Award, completed: training.postExamCompleted ?? false, active: false },
  ];

  if (!training.preExamCompleted) {
    steps[0].active = true;
  } else if (!training.videosCompleted) {
    steps[1].active = true;
  } else if (!training.postExamCompleted) {
    steps[2].active = true;
  }

  // Overall progress
  const completedSteps = steps.filter(s => s.completed).length;
  const overallProgress = Math.round((completedSteps / steps.length) * 100);

  // Determine CTA
  let ctaHref = `/exam/${training.id}/pre-exam`;
  let ctaLabel = 'Ön Sınava Başla';
  let ctaIcon = <FileQuestion className="h-5 w-5" />;
  if (training.preExamCompleted && !training.videosCompleted) {
    ctaHref = `/exam/${training.id}/videos`;
    ctaLabel = 'Videoları İzlemeye Başla';
    ctaIcon = <Play className="h-5 w-5" />;
  } else if (training.videosCompleted && !training.postExamCompleted) {
    ctaHref = `/exam/${training.id}/post-exam`;
    ctaLabel = 'Son Sınava Başla';
    ctaIcon = <Award className="h-5 w-5" />;
  } else if (training.postExamCompleted) {
    ctaHref = '#';
    ctaLabel = 'Eğitim Tamamlandı';
    ctaIcon = <CheckCircle className="h-5 w-5" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Hero Banner ── */}
      <BlurFade delay={0}>
        <div className="relative overflow-hidden rounded-2xl p-6 pb-5" style={{
          background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
          boxShadow: '0 8px 32px rgba(13, 150, 104, 0.25)',
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2), transparent 40%)',
          }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <button
                  onClick={() => router.back()}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                      <BookOpen className="h-3 w-3" /> {training.category || 'Eğitim'}
                    </span>
                    {training.status === 'assigned' && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                        <AlertCircle className="h-3 w-3" /> Atandı
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    {training.title}
                  </h1>
                  {training.description && (
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {training.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Info chips */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}>
                <Target className="h-3.5 w-3.5" /> Deneme {training.currentAttempt ?? 0}/{training.maxAttempts ?? 3}
              </div>
              {training.deadline && (
                <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}>
                  <Calendar className="h-3.5 w-3.5" /> {training.deadline}
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}>
                <Clock className="h-3.5 w-3.5" /> {training.examDuration ?? 30} dk sınav
              </div>
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}>
                <Award className="h-3.5 w-3.5" /> Geçme puanı: {training.passingScore ?? 70}
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${overallProgress}%`, background: 'rgba(255,255,255,0.8)' }} />
              </div>
              <span className="text-xs font-bold text-white font-mono">{overallProgress}%</span>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* ── Step Progress ── */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-3 gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.active;
            const isCompleted = step.completed;
            const isLocked = !isActive && !isCompleted;

            const card = (
              <div className="relative rounded-2xl border p-5 text-center transition-colors duration-200 h-full" style={{
                background: isActive ? 'var(--color-primary-light)' : isCompleted ? 'var(--color-success-bg)' : 'var(--color-surface)',
                borderColor: isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-border)',
                borderWidth: isActive ? '2px' : '1px',
                opacity: isLocked ? 0.6 : 1,
              }}>
                {/* Step number badge */}
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{
                    background: isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                </div>

                <div className="mx-auto mb-3 mt-1 flex h-12 w-12 items-center justify-center rounded-2xl" style={{
                  background: isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  boxShadow: (isCompleted || isActive) ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {isCompleted ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : isLocked ? (
                    <Lock className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                  ) : (
                    <Icon className="h-6 w-6" style={{ color: isActive ? 'white' : 'var(--color-text-muted)' }} />
                  )}
                </div>

                <h4 className="text-sm font-bold mb-0.5">{step.label}</h4>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{step.sublabel}</p>

                {step.score !== undefined && isCompleted && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                    Puan: {step.score}%
                  </div>
                )}
                {step.progress && !isLocked && (
                  <div className="mt-2">
                    <div className="mx-auto h-1.5 w-16 rounded-full" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${videoProgress}%`, background: isCompleted ? 'var(--color-success)' : 'var(--color-primary)' }} />
                    </div>
                    <p className="mt-1 text-[11px] font-mono font-semibold" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                      {step.progress}
                    </p>
                  </div>
                )}
                {isLocked && (
                  <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Kilitli</p>
                )}
                {isActive && !isCompleted && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'var(--color-primary)', color: 'white' }}>
                    Sıradaki adım
                  </div>
                )}
              </div>
            );

            if (isActive) {
              return (
                <div key={step.id}>
                  <ShineBorder color={['#0d9668', '#f59e0b']} borderWidth={1.5} duration={8} className="rounded-2xl h-full">
                    {card}
                  </ShineBorder>
                </div>
              );
            }

            return <div key={step.id}>{card}</div>;
          })}
        </div>

        {/* Connector line between steps */}
        <div className="flex items-center justify-center gap-0 mt-3 px-16">
          {steps.map((step, idx) => {
            if (idx === steps.length - 1) return null;
            const lineCompleted = step.completed;
            return (
              <div key={`line-${idx}`} className="flex-1 flex items-center">
                <div className="w-full h-0.5 rounded-full" style={{ background: lineCompleted ? 'var(--color-success)' : 'var(--color-border)' }} />
                <ChevronRight className="h-4 w-4 shrink-0 -mx-1" style={{ color: lineCompleted ? 'var(--color-success)' : 'var(--color-border)' }} />
              </div>
            );
          })}
        </div>
      </BlurFade>

      {/* ── Video List ── */}
      <BlurFade delay={0.1}>
        <div className="relative overflow-hidden rounded-2xl border p-6" style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          opacity: training.preExamCompleted ? 1 : 0.5,
          pointerEvents: training.preExamCompleted ? 'auto' : 'none',
        }}>
          {!training.preExamCompleted && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)' }}>
              <div className="flex flex-col items-center gap-2">
                <Lock className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Önce ön sınavı tamamlayın</p>
              </div>
            </div>
          )}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h3 className="text-base font-bold">Eğitim Videoları</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{completedVideos}/{videos.length} tamamlandı</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-28 rounded-full" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${videoProgress}%`, background: videoProgress === 100 ? 'var(--color-success)' : 'var(--color-primary)' }} />
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: videoProgress === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{videoProgress}%</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {videos.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-surface-hover)' }}>
                  <Video className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Henüz video eklenmemiş</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Bu eğitime video eklendiğinde burada görünecek</p>
                </div>
              </div>
            )}
            {videos.map((v, i) => {
              const canWatch = training.preExamCompleted;
              const isNext = canWatch && !v.completed && i === completedVideos;
              const isLocked = !v.completed && !isNext;
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-4 rounded-xl p-4 transition-colors duration-200 group"
                  style={{
                    border: `1px solid ${isNext ? 'var(--color-primary)' : v.completed ? 'var(--color-success-bg)' : 'var(--color-border)'}`,
                    background: v.completed ? 'var(--color-success-bg)' : isNext ? 'var(--color-primary-light)' : 'transparent',
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  {isNext && <BorderBeam size={60} duration={6} colorFrom="var(--color-primary)" colorTo="#f59e0b" />}
                  {/* Video number */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{
                    background: v.completed ? 'var(--color-success)' : isNext ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                    color: (v.completed || isNext) ? 'white' : 'var(--color-text-muted)',
                  }}>
                    {v.completed ? <CheckCircle className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Video {i + 1}</span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>·</span>
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock className="h-3 w-3" /> {v.duration}
                      </span>
                    </div>
                  </div>
                  {v.completed && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--color-success)', color: 'white' }}>
                      Tamamlandı
                    </span>
                  )}
                  {isNext && (
                    <Link href={`/exam/${training.id}/videos`}>
                      <Button size="sm" className="gap-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                        <Play className="h-3 w-3" /> İzle
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* All videos completed → Go to post-exam */}
          {training.preExamCompleted && training.videosCompleted && !training.postExamCompleted && videos.length > 0 && (
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--color-accent-light, var(--color-warning-bg))', border: '1px solid var(--color-accent, var(--color-warning))' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent, var(--color-warning))' }}>
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Tüm videolar izlendi!</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Şimdi son sınava geçebilirsiniz</p>
                  </div>
                </div>
                <Link href={`/exam/${training.id}/post-exam`}>
                  <Button className="gap-2 font-semibold text-white rounded-xl" style={{ background: 'var(--color-accent, var(--color-warning))' }}>
                    Son Sınava Git <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </BlurFade>

      {/* ── Main CTA ── */}
      <BlurFade delay={0.15}>
        <div className="flex justify-center pb-4">
          {training.postExamCompleted ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--color-success-bg)' }}>
                <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>Eğitim Tamamlandı!</p>
            </div>
          ) : (
            <Link href={ctaHref}>
              <ShimmerButton
                className="gap-2.5 px-10 py-3.5 text-base font-semibold"
                borderRadius="14px"
                background="linear-gradient(135deg, #0d9668, #065f46)"
                shimmerColor="rgba(255,255,255,0.15)"
              >
                {ctaIcon} {ctaLabel}
              </ShimmerButton>
            </Link>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
