'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, FileQuestion, CheckCircle, Clock, Play, Target, Calendar } from 'lucide-react';
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

  const steps = [
    { id: 'pre_exam', label: 'Ön Sınav', icon: FileQuestion, completed: training.preExamCompleted ?? false, active: false, score: training.preExamScore },
    { id: 'videos', label: 'Eğitim Videoları', icon: Video, completed: training.videosCompleted ?? false, active: true, progress: `${completedVideos}/${videos.length}` },
    { id: 'post_exam', label: 'Son Sınav', icon: FileQuestion, completed: training.postExamCompleted ?? false, active: false },
  ];

  // Determine which step is active
  if (!training.preExamCompleted) {
    steps[0].active = true;
    steps[1].active = false;
  } else if (!training.videosCompleted) {
    steps[0].active = false;
    steps[1].active = true;
  } else if (!training.postExamCompleted) {
    steps[0].active = false;
    steps[1].active = false;
    steps[2].active = true;
  } else {
    steps.forEach(s => { s.active = false; });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">{training.title}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                {training.category}
              </span>
              <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Deneme {training.currentAttempt ?? 0}/{training.maxAttempts ?? 3}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {training.deadline}</span>
            </div>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{training.description}</p>
      </BlurFade>

      {/* Step Progress */}
      <BlurFade delay={0.1}>
        <div className="grid grid-cols-3 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.active;
            const isCompleted = step.completed;

            const CardContent = (
              <div className="rounded-2xl border p-6 text-center transition-all duration-200" style={{
                background: isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
                borderColor: isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-border)',
                borderWidth: isActive ? '2px' : '1px',
              }}>
                {/* Step number + icon */}
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{
                  background: isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  boxShadow: (isCompleted || isActive) ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {isCompleted ? <CheckCircle className="h-7 w-7 text-white" /> : <Icon className="h-7 w-7" style={{ color: isActive ? 'white' : 'var(--color-text-muted)' }} />}
                </div>
                <h4 className="text-sm font-bold mb-1">{step.label}</h4>
                {step.score !== undefined && (
                  <p className="text-xs font-mono font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    Puan: {step.score}%
                  </p>
                )}
                {step.progress && (
                  <p className="text-xs font-mono font-semibold" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                    {step.progress} video
                  </p>
                )}
                {!isCompleted && !isActive && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bekliyor</p>
                )}
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="absolute right-0 top-1/2 w-4 h-0.5 translate-x-full -translate-y-1/2" style={{ background: isCompleted ? 'var(--color-success)' : 'var(--color-border)' }} />
                )}
              </div>
            );

            if (isActive) {
              return (
                <div key={step.id} className="relative">
                  <ShineBorder color={['#0d9668', '#f59e0b']} borderWidth={1.5} duration={8} className="rounded-2xl">
                    {CardContent}
                  </ShineBorder>
                </div>
              );
            }

            return <div key={step.id} className="relative">{CardContent}</div>;
          })}
        </div>
      </BlurFade>

      {/* Video List */}
      <BlurFade delay={0.15}>
        <div className="relative overflow-hidden rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          {/* Video progress header */}
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
              <div className="h-2 w-24 rounded-full" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${videoProgress}%`, background: 'var(--color-primary)' }} />
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{videoProgress}%</span>
            </div>
          </div>

          <div className="space-y-3">
            {videos.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
            )}
            {videos.map((v, i) => {
              const isNext = !v.completed && i === completedVideos;
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-4 rounded-xl p-4 transition-all duration-200 group"
                  style={{
                    border: `1px solid ${isNext ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: v.completed ? 'var(--color-success-bg)' : isNext ? 'var(--color-primary-light)' : 'transparent',
                  }}
                >
                  {isNext && <BorderBeam size={60} duration={6} colorFrom="var(--color-primary)" colorTo="#f59e0b" />}
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{
                    background: v.completed ? 'var(--color-success)' : isNext ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  }}>
                    {v.completed ? <CheckCircle className="h-5 w-5 text-white" /> : <Play className="h-5 w-5" style={{ color: isNext ? 'white' : 'var(--color-text-muted)' }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ opacity: !v.completed && !isNext ? 0.5 : 1 }}>{v.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Video {i + 1}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--color-text-muted)' }}>{v.duration}</span>
                    </div>
                    {isNext && (
                      <Link href={`/exam/${training.id}/videos`}>
                        <Button size="sm" className="gap-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                          <Play className="h-3 w-3" /> İzle
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Main Action */}
      <BlurFade delay={0.2}>
        <div className="flex justify-center">
          <Link href={training.videosCompleted ? `/exam/${training.id}/post-exam` : `/exam/${training.id}/videos`}>
            <ShimmerButton
              className="gap-2.5 px-8 py-3 text-base font-semibold"
              borderRadius="14px"
              background="linear-gradient(135deg, #0d9668, #065f46)"
              shimmerColor="rgba(255,255,255,0.15)"
            >
              <Play className="h-5 w-5" /> {training.videosCompleted ? 'Son Sınava Geç' : 'Videoları İzlemeye Devam Et'}
            </ShimmerButton>
          </Link>
        </div>
      </BlurFade>
    </div>
  );
}
