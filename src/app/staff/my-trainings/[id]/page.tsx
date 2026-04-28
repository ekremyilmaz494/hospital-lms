'use client';

/**
 * Eğitim detayı — "Clinical Editorial" redesign.
 * Tüm iş mantığı korundu: step progression, retry mode, exam-only, expired, pass/fail states.
 * Dil: cream + ink + gold + serif display + mono caps + radial dot bg.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft, Video, FileQuestion, CheckCircle2, Clock, Play, Target,
  Calendar, Award, ChevronRight, Lock, AlertTriangle, RefreshCw, Send,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { calculateTrainingProgress } from '@/lib/training-progress';
import { INK, INK_SOFT, CREAM, RULE, GOLD, OLIVE, CARD_BG } from '@/lib/editorial-palette';

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

  const { data: training, isLoading, error, refetch } = useFetch<TrainingDetail>(apiUrl);
  const { toast } = useToast();

  type AttemptRequest = {
    id: string;
    trainingId: string;
    status: 'pending' | 'approved' | 'rejected';
    grantedAttempts: number | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
  const { data: requestData, refetch: refetchRequests } = useFetch<{ requests: AttemptRequest[] }>(
    id ? `/api/staff/attempt-requests?trainingId=${encodeURIComponent(id)}` : null,
  );
  const myRequest = requestData?.requests?.[0] ?? null;

  const [reasonText, setReasonText] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const submitAttemptRequest = async () => {
    if (!id || reasonText.trim().length < 10) {
      toast('Lütfen en az 10 karakterlik açıklama yazın', 'error');
      return;
    }
    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/staff/attempt-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId: id, reason: reasonText.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Talep gönderilemedi');
      toast(body.message || 'Talebiniz iletildi', 'success');
      setReasonText('');
      refetchRequests();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const pageShell = (children: React.ReactNode) => (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16 max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );

  if (isLoading) return pageShell(<DetailSkeleton />);

  if (error) {
    const notFound = error === 'Eğitim ataması bulunamadı' || error.includes('not found') || error.includes('404');
    return pageShell(
      <div
        className="mt-10 grid items-start gap-4 p-5"
        style={{
          gridTemplateColumns: '4px 44px 1fr',
          backgroundColor: '#fdf5f2',
          border: `1px solid #e9c9c0`,
          borderRadius: '4px',
        }}
      >
        <span style={{ backgroundColor: '#b3261e', alignSelf: 'stretch', borderRadius: '2px' }} />
        <div
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, backgroundColor: '#b3261e', borderRadius: '2px' }}
        >
          <AlertTriangle className="h-5 w-5" style={{ color: CREAM }} />
        </div>
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            Erişim hatası
          </p>
          <h2
            className="mt-1 text-[18px] font-semibold tracking-[-0.01em]"
            style={{ color: '#7a1d14', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {notFound ? 'Eğitime erişilemiyor' : 'Eğitim yüklenemedi'}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: '#7a1d14' }}>
            {notFound ? 'Bu eğitime erişim yetkin yok veya eğitim bulunamadı.' : error}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/staff/my-trainings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: INK, border: `1px solid ${INK}`, borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <ArrowLeft className="h-3 w-3" style={{ color: GOLD }} />
              Eğitimlerime Dön
            </Link>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: CREAM, backgroundColor: INK, borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <RefreshCw className="h-3 w-3" style={{ color: GOLD }} />
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>,
    );
  }

  if (!training) {
    return pageShell(<p className="mt-10 text-[13px]" style={{ color: INK_SOFT }}>Eğitim bulunamadı.</p>);
  }

  const videos = training.videos ?? [];
  const completedVideos = videos.filter(v => v.completed).length;
  const videoProgress = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

  // Tek doğruluk kaynağı — list ekranlarıyla aynı helper.
  const { completedSteps, totalSteps, percent: overallProgress, isRetry, isExamOnly } =
    calculateTrainingProgress({
      examOnly: training.examOnly === true,
      attemptNumber: training.currentAttempt ?? 0,
      needsRetry: training.needsRetry,
      preExamCompleted: training.preExamCompleted,
      videosCompleted: training.videosCompleted,
      postExamCompleted: training.postExamCompleted,
    });
  const currentStep = completedSteps;
  const allDone = completedSteps >= totalSteps;

  const examId = training.assignmentId || training.id;
  let ctaHref = `/exam/${examId}/post-exam`;
  let ctaLabel = 'Sınava Başla';
  let ctaIcon: LucideIcon = Award;
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

  const steps: { label: string; desc: string; icon: LucideIcon; done: boolean; score?: number }[] = isExamOnly
    ? [{ label: 'Sınav', desc: 'Değerlendirme sınavı', icon: Award, done: training.postExamCompleted }]
    : isRetry
      ? [
          { label: 'Eğitim Videoları', desc: `${videos.length} video`, icon: Video, done: training.videosCompleted },
          { label: 'Son Sınav',        desc: 'Değerlendirme sınavı',  icon: Award, done: training.postExamCompleted },
        ]
      : [
          { label: 'Ön Sınav',         desc: 'Bilgi seviyesi testi',  icon: FileQuestion, done: training.preExamCompleted, score: training.preExamScore },
          { label: 'Eğitim Videoları', desc: `${videos.length} video`, icon: Video, done: training.videosCompleted },
          { label: 'Son Sınav',        desc: 'Değerlendirme sınavı',  icon: Award, done: training.postExamCompleted },
        ];

  const CtaIcon = ctaIcon;

  return pageShell(
    <>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] mb-6"
        style={{
          color: INK,
          border: `1px solid ${RULE}`,
          borderRadius: '2px',
          backgroundColor: 'transparent',
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          transition: 'background-color 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <ArrowLeft className="h-3 w-3" style={{ color: GOLD }} />
        Eğitimlerim
      </button>

      {/* ───── Masthead ───── */}
      <header
        className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-5"
        style={{ borderBottom: `3px solid ${INK}` }}
      >
        <div className="flex items-end gap-4 min-w-0" />

        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            color: INK, backgroundColor: 'rgba(201, 169, 97, 0.12)',
            border: `1px solid ${GOLD}`, borderRadius: '2px',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          }}
        >
          Deneme {Math.max(training.currentAttempt ?? 0, 1).toString().padStart(2, '0')}
          <span style={{ color: GOLD }}>/</span>
          {(training.maxAttempts ?? 3).toString().padStart(2, '0')}
        </span>
      </header>

      <h1
        className="mt-5 text-[32px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.025em]"
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {training.title}
        <span style={{ color: GOLD }}>.</span>
      </h1>

      {training.description && (
        <p className="mt-3 text-[14px] leading-relaxed max-w-2xl" style={{ color: INK_SOFT }}>
          {training.description}
        </p>
      )}

      {/* Meta chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        <MetaChip icon={Calendar} label="Son tarih" value={training.deadline || '—'} tone={{ ink: '#1f3a7a', bg: '#eef2fb', soft: '#2c55b8' }} />
        <MetaChip icon={Clock}    label="Süre"      value={`${training.examDuration ?? 30} dk`} tone={{ ink: '#6a4e11', bg: '#fef6e7', soft: '#b4820b' }} />
        <MetaChip icon={Target}   label="Geçme"     value={`%${training.passingScore ?? 70}`} tone={{ ink: '#0d2010', bg: '#eaf6ef', soft: OLIVE }} />
      </div>

      {/* Overall progress */}
      <div
        className="mt-6 p-4"
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${RULE}`,
          borderLeft: `4px solid ${OLIVE}`,
          borderRadius: '4px',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: OLIVE, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            Genel ilerleme
          </span>
          <span
            className="text-[11px] font-semibold tabular-nums tracking-[0.1em]"
            style={{ color: INK, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {completedSteps.toString().padStart(2, '0')}/{totalSteps.toString().padStart(2, '0')} · <span style={{ color: OLIVE }}>%{overallProgress}</span>
          </span>
        </div>
        <div
          className="relative h-[8px] w-full overflow-hidden"
          style={{ backgroundColor: RULE, borderRadius: '1px' }}
        >
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${overallProgress}%`,
              backgroundColor: OLIVE,
              transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Expired banner */}
      {training.isExpired && !allDone && (
        <EditorialBanner
          tone="error"
          icon={AlertTriangle}
          title="Bu eğitimin süresi dolmuş"
          description={`Eğitim süresi ${training.deadline} tarihinde sona erdi. Sınava giriş yapılamaz.`}
        />
      )}

      {/* Retry banner */}
      {isRetry && training.status !== 'failed' && !training.isExpired && (
        <EditorialBanner
          tone="warning"
          icon={RefreshCw}
          title={`${training.currentAttempt}. deneme hakkındasın`}
          description={`${training.lastAttemptScore !== undefined ? `Önceki deneme puanı: %${training.lastAttemptScore}. ` : ''}Ön sınav atlandı. Videoları izleyip son sınava gir. (Toplam ${training.maxAttempts} hak)`}
        />
      )}

      {/* ───── Steps ───── */}
      <section className="mt-10">
        <header
          className="grid items-end gap-4 pb-3"
          style={{ gridTemplateColumns: '40px 1fr', borderBottom: `3px solid ${GOLD}` }}
        >
          <span
            className="text-[13px] font-semibold tracking-[0.2em]"
            style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            §
          </span>
          <div>
            <h2
              className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              İlerleme aşamaları
            </h2>
            <p
              className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              {isExamOnly ? 'Tek aşama' : isRetry ? '2 aşama (deneme modu)' : '3 aşama'}
            </p>
          </div>
        </header>

        <div className="mt-5 relative">
          {/* Spine */}
          <div
            aria-hidden
            className="absolute top-5 bottom-5"
            style={{ left: 21, width: 2, backgroundColor: RULE }}
          />

          <ul className="space-y-3">
            {steps.map((step, idx) => (
              <StepRow
                key={idx}
                step={step}
                idx={idx}
                isCurrent={idx === currentStep && !allDone}
                isLocked={idx > currentStep}
              />
            ))}
          </ul>
        </div>
      </section>

      {/* ───── Videos ───── */}
      {(training.preExamCompleted || isRetry) && videos.length > 0 && !allDone && (
        <section className="mt-12">
          <header
            className="grid items-end gap-4 pb-3"
            style={{ gridTemplateColumns: '40px 1fr max-content', borderBottom: `3px solid ${OLIVE}` }}
          >
            <span
              className="text-[13px] font-semibold tracking-[0.2em]"
              style={{ color: OLIVE, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              ▶
            </span>
            <div>
              <h2
                className="text-[20px] leading-tight font-semibold tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                Eğitim videoları
              </h2>
              <p
                className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                %{videoProgress} tamamlandı · {completedVideos.toString().padStart(2, '0')}/{videos.length.toString().padStart(2, '0')}
              </p>
            </div>
            <div
              className="relative h-[4px] w-24 overflow-hidden"
              style={{ backgroundColor: RULE, borderRadius: '1px' }}
            >
              <div
                className="absolute left-0 top-0 h-full"
                style={{ width: `${videoProgress}%`, backgroundColor: OLIVE }}
              />
            </div>
          </header>

          <ul
            className="mt-5"
            style={{
              backgroundColor: CARD_BG,
              borderTop: `1px solid ${RULE}`,
              borderRight: `1px solid ${RULE}`,
              borderBottom: `1px solid ${RULE}`,
              borderLeft: `6px solid ${OLIVE}`,
              borderRadius: '4px',
            }}
          >
            {videos.map((v, i, arr) => {
              const isNext = !v.completed && i === completedVideos;
              const isLocked = !v.completed && !isNext;
              return (
                <li
                  key={i}
                  className="grid items-center gap-3 px-4 py-3"
                  style={{
                    gridTemplateColumns: '36px 1fr max-content',
                    borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${RULE}`,
                    backgroundColor: isNext ? 'rgba(201, 169, 97, 0.08)' : v.completed ? '#f7fcf8' : 'transparent',
                    opacity: isLocked ? 0.55 : 1,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center text-[11px] font-semibold tabular-nums"
                    style={{
                      width: 32, height: 32,
                      backgroundColor: v.completed ? '#eaf6ef' : isNext ? INK : CREAM,
                      color: v.completed ? '#0a7a47' : isNext ? CREAM : INK_SOFT,
                      border: v.completed ? 'none' : `1px solid ${RULE}`,
                      borderRadius: '2px',
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    }}
                  >
                    {v.completed ? <CheckCircle2 className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : (i + 1).toString().padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold tracking-[-0.01em]"
                      style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                    >
                      {v.title}
                    </p>
                    <p
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {v.duration}
                    </p>
                  </div>
                  {v.completed ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
                      style={{
                        color: '#0a7a47', backgroundColor: '#eaf6ef',
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      }}
                    >
                      TAMAMLANDI
                    </span>
                  ) : isNext ? (
                    <Link
                      href={`/exam/${examId}/videos`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        color: CREAM, backgroundColor: INK, borderRadius: '2px',
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      }}
                    >
                      <Play className="h-3 w-3" fill="currentColor" style={{ color: GOLD }} />
                      İzle
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {training.videosCompleted && !training.postExamCompleted && (
            <div
              className="mt-4 flex flex-col gap-4 p-4 sm:grid sm:items-center"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${RULE}`,
                borderRadius: '4px',
                gridTemplateColumns: '4px 44px 1fr max-content',
              }}
            >
              <span
                className="hidden sm:block"
                style={{ backgroundColor: OLIVE, alignSelf: 'stretch', borderRadius: '2px' }}
              />
              <div className="flex items-center gap-3 sm:contents">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 44, height: 44, backgroundColor: '#eaf6ef', borderRadius: '2px' }}
                >
                  <Award className="h-5 w-5" style={{ color: OLIVE }} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: OLIVE, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Hazır
                  </p>
                  <p
                    className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Tüm videolar tamamlandı — son sınava geç
                  </p>
                </div>
              </div>
              <Link
                href={`/exam/${examId}/post-exam`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  color: CREAM, backgroundColor: OLIVE, borderRadius: '2px',
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                <Award className="h-3.5 w-3.5" style={{ color: GOLD }} />
                Son Sınav
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ───── Main CTA ───── */}
      {!allDone && !training.isExpired && (
        <Link
          href={ctaHref}
          className="mt-10 group flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5"
          style={{
            backgroundColor: INK,
            color: CREAM,
            borderRadius: '4px',
            border: `1px solid ${INK}`,
            transition: 'background-color 200ms ease, transform 220ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = OLIVE; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = INK; }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex shrink-0 items-center justify-center"
              style={{ width: 40, height: 40, backgroundColor: 'rgba(201, 169, 97, 0.15)', borderRadius: '2px' }}
            >
              <CtaIcon className="h-5 w-5" style={{ color: GOLD }} />
            </span>
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Sonraki adım
              </p>
              <p
                className="mt-0.5 truncate text-[17px] sm:text-[20px] font-semibold tracking-[-0.01em]"
                style={{ color: CREAM, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                {ctaLabel}
              </p>
            </div>
          </div>
          <ChevronRight
            className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1"
            style={{ color: GOLD }}
          />
        </Link>
      )}

      {/* ───── Passed state ───── */}
      {training.status === 'passed' && (
        <section className="mt-10">
          <div
            className="grid items-start gap-4 p-6"
            style={{
              gridTemplateColumns: '6px 52px 1fr',
              backgroundColor: '#f7fcf8',
              borderTop: `1px solid #bfe0cb`,
              borderRight: `1px solid #bfe0cb`,
              borderBottom: `1px solid #bfe0cb`,
              borderRadius: '4px',
            }}
          >
            <span style={{ backgroundColor: OLIVE, alignSelf: 'stretch', borderRadius: '2px' }} />
            <div
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, backgroundColor: '#eaf6ef', borderRadius: '2px' }}
            >
              <CheckCircle2 className="h-6 w-6" style={{ color: OLIVE }} />
            </div>
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: OLIVE, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Tamamlandı
              </p>
              <h2
                className="mt-1 text-[22px] font-semibold tracking-[-0.01em]"
                style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                Eğitim başarıyla tamamlandı
              </h2>
              {training.lastAttemptScore !== undefined && (
                <p className="mt-1 text-[13px]" style={{ color: INK_SOFT }}>
                  Son sınav puanı <span style={{ color: INK, fontWeight: 600 }}>%{training.lastAttemptScore}</span>
                </p>
              )}
            </div>
          </div>

          <div
            className="mt-4"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}`, borderRadius: '4px' }}
          >
            {videos.length > 0 && (
              <Link
                href={`/exam/${examId}/videos?mode=review`}
                className="grid items-center gap-3 px-5 py-4 group"
                style={{
                  gridTemplateColumns: '36px 1fr max-content',
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ width: 36, height: 36, backgroundColor: INK, borderRadius: '2px' }}
                >
                  <Play className="h-4 w-4" fill="currentColor" style={{ color: GOLD }} />
                </span>
                <div>
                  <h4
                    className="text-[14px] font-semibold tracking-[-0.01em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Eğitim içeriğini tekrar izle
                  </h4>
                  <p
                    className="mt-0.5 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    {videos.length} video · istediğin zaman
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: GOLD }} />
              </Link>
            )}

            <Link
              href="/staff/certificates"
              className="grid items-center gap-3 px-5 py-4 group"
              style={{ gridTemplateColumns: '36px 1fr max-content' }}
            >
              <span
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, backgroundColor: '#eaf6ef', borderRadius: '2px' }}
              >
                <Award className="h-4 w-4" style={{ color: OLIVE }} />
              </span>
              <div>
                <h4
                  className="text-[14px] font-semibold tracking-[-0.01em]"
                  style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                >
                  Sertifikalarıma git
                </h4>
                <p
                  className="mt-0.5 text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  Başarı sertifikana ulaş
                </p>
              </div>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: GOLD }} />
            </Link>
          </div>
        </section>
      )}

      {/* ───── Failed state ───── */}
      {allDone && training.status === 'failed' && (
        <section
          className="mt-10 grid items-start gap-4 p-6"
          style={{
            gridTemplateColumns: '6px 52px 1fr',
            backgroundColor: '#fdf5f2',
            borderTop: `1px solid #e9c9c0`,
            borderRight: `1px solid #e9c9c0`,
            borderBottom: `1px solid #e9c9c0`,
            borderRadius: '4px',
          }}
        >
          <span style={{ backgroundColor: '#b3261e', alignSelf: 'stretch', borderRadius: '2px' }} />
          <div
            className="flex items-center justify-center"
            style={{ width: 52, height: 52, backgroundColor: '#b3261e', borderRadius: '2px' }}
          >
            <Lock className="h-6 w-6" style={{ color: CREAM }} />
          </div>
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Haklar tükendi
            </p>
            <h2
              className="mt-1 text-[20px] font-semibold tracking-[-0.01em]"
              style={{ color: '#7a1d14', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              Tüm deneme hakları kullanıldı
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: '#7a1d14' }}>
              {training.maxAttempts} deneme hakkının tamamını kullandın. Yöneticinden ek deneme hakkı talep edebilirsin.
            </p>

            {/* Talep durumu / formu */}
            <div className="mt-4 w-full" style={{ maxWidth: 520 }}>
              {myRequest?.status === 'pending' && (
                <div
                  className="px-3 py-2.5 text-[12px]"
                  style={{
                    background: '#fef3c7', color: '#78350f',
                    border: '1px solid #fcd34d', borderRadius: 4,
                  }}
                >
                  <strong className="block mb-0.5">Talebiniz inceleniyor</strong>
                  Yöneticinizin değerlendirmesi bekleniyor. Talep tarihi:{' '}
                  {new Date(myRequest.createdAt).toLocaleDateString('tr-TR')}
                </div>
              )}

              {myRequest?.status === 'rejected' && (
                <div
                  className="px-3 py-2.5 text-[12px]"
                  style={{
                    background: '#fee2e2', color: '#7a1d14',
                    border: '1px solid #fca5a5', borderRadius: 4,
                  }}
                >
                  <strong className="block mb-0.5">Önceki talebiniz reddedildi</strong>
                  {myRequest.reviewNote && (
                    <span className="block mt-1">Yöneticinin notu: {myRequest.reviewNote}</span>
                  )}
                </div>
              )}

              {(!myRequest || myRequest.status === 'rejected') && (
                <div className="mt-2">
                  <label
                    className="block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
                    style={{ color: '#7a1d14', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Ek hak talebi — gerekçe
                  </label>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Neden ek deneme hakkı istediğini kısaca açıkla (en az 10 karakter)"
                    maxLength={1000}
                    rows={3}
                    disabled={submittingRequest}
                    className="w-full px-3 py-2 text-[13px]"
                    style={{
                      background: CREAM, color: '#7a1d14',
                      border: `1px solid #b3261e`, borderRadius: 2,
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px]" style={{ color: '#7a1d14', opacity: 0.7 }}>
                      {reasonText.trim().length}/1000
                    </span>
                    <button
                      type="button"
                      onClick={submitAttemptRequest}
                      disabled={submittingRequest || reasonText.trim().length < 10}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        background: '#b3261e', color: CREAM,
                        border: `1px solid #b3261e`, borderRadius: 2,
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                        opacity: submittingRequest || reasonText.trim().length < 10 ? 0.5 : 1,
                        cursor: submittingRequest || reasonText.trim().length < 10 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Send className="h-3 w-3" />
                      {submittingRequest ? 'Gönderiliyor…' : 'Talep gönder'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/staff/my-trainings"
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: '#7a1d14', border: `1px solid #7a1d14`, borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <ArrowLeft className="h-3 w-3" />
              Eğitimlerime Dön
            </Link>
          </div>
        </section>
      )}
    </>,
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function MetaChip({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon; label: string; value: string;
  tone: { ink: string; bg: string; soft: string };
}) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-2"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid ${tone.soft}`,
        borderRadius: '2px',
      }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{
          width: 22, height: 22,
          backgroundColor: tone.bg,
          borderRadius: '2px',
        }}
      >
        <Icon className="h-3 w-3" style={{ color: tone.soft }} />
      </span>
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: tone.soft, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-semibold tabular-nums"
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {value}
      </span>
    </span>
  );
}

function EditorialBanner({
  tone, icon: Icon, title, description,
}: {
  tone: 'error' | 'warning' | 'success';
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const toneMap = {
    error:   { ink: '#7a1d14', soft: '#b3261e', bg: '#fdf5f2', border: '#e9c9c0' },
    warning: { ink: '#6a4e11', soft: '#b4820b', bg: '#fef6e7', border: '#e8d6a8' },
    success: { ink: '#0d2010', soft: OLIVE,     bg: '#eaf6ef', border: '#bfe0cb' },
  }[tone];

  return (
    <div
      className="mt-6 grid items-start gap-4 p-4"
      style={{
        gridTemplateColumns: '6px 44px 1fr',
        backgroundColor: toneMap.bg,
        borderTop: `1px solid ${toneMap.border}`,
        borderRight: `1px solid ${toneMap.border}`,
        borderBottom: `1px solid ${toneMap.border}`,
        borderRadius: '4px',
      }}
    >
      <span style={{ backgroundColor: toneMap.soft, alignSelf: 'stretch', borderRadius: '2px' }} />
      <div
        className="flex items-center justify-center"
        style={{ width: 44, height: 44, backgroundColor: toneMap.soft, borderRadius: '2px' }}
      >
        <Icon className="h-5 w-5" style={{ color: CREAM }} />
      </div>
      <div>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: toneMap.soft, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {title}
        </p>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: toneMap.ink }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function StepRow({
  step, idx, isCurrent, isLocked,
}: {
  step: { label: string; desc: string; icon: LucideIcon; done: boolean; score?: number };
  idx: number;
  isCurrent: boolean;
  isLocked: boolean;
}) {
  const StepIcon = step.icon;
  const bgColor = step.done
    ? OLIVE
    : isCurrent
      ? INK
      : CREAM;
  const fgColor = step.done || isCurrent ? CREAM : INK_SOFT;
  const ringColor = isCurrent ? 'rgba(201, 169, 97, 0.3)' : 'transparent';

  return (
    <li
      className="relative grid items-start gap-4"
      style={{
        gridTemplateColumns: '44px 1fr',
        opacity: isLocked ? 0.5 : 1,
      }}
    >
      <div
        className="relative flex items-center justify-center shrink-0 z-10"
        style={{
          width: 44, height: 44,
          backgroundColor: bgColor,
          color: fgColor,
          border: `1px solid ${step.done ? OLIVE : isCurrent ? INK : RULE}`,
          borderRadius: '2px',
          boxShadow: isCurrent ? `0 0 0 4px ${ringColor}` : 'none',
        }}
      >
        {step.done ? <CheckCircle2 className="h-5 w-5" /> : isLocked ? <Lock className="h-4 w-4" /> : <StepIcon className="h-5 w-5" />}
      </div>
      <div
        className="p-4"
        style={{
          backgroundColor: step.done ? '#f7fcf8' : isCurrent ? 'rgba(201, 169, 97, 0.06)' : '#ffffff',
          borderTop: `1px solid ${RULE}`,
          borderRight: `1px solid ${RULE}`,
          borderBottom: `1px solid ${RULE}`,
          borderLeft: step.done ? `6px solid ${OLIVE}` : isCurrent ? `6px solid ${GOLD}` : `2px solid ${RULE}`,
          borderRadius: '4px',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{
              color: step.done ? OLIVE : isCurrent ? GOLD : INK_SOFT,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            Aşama {(idx + 1).toString().padStart(2, '0')}
          </span>
          {step.done && (
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: OLIVE, backgroundColor: '#eaf6ef',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              TAMAM
            </span>
          )}
          {isCurrent && (
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: GOLD, backgroundColor: 'rgba(201, 169, 97, 0.12)',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              AKTİF
            </span>
          )}
        </div>
        <h3
          className="mt-1 text-[16px] font-semibold tracking-[-0.01em]"
          style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
        >
          {step.label}
        </h3>
        <p className="mt-0.5 text-[12px]" style={{ color: INK_SOFT }}>
          {step.desc}
        </p>
        {step.score !== undefined && step.done && (
          <p
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums"
            style={{
              color: OLIVE,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            PUAN · %{step.score}
          </p>
        )}
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="h-3 w-40" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '2px' }} />
      <div className="h-12 w-3/4" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '2px' }} />
      <div className="h-4 w-1/2" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '2px' }} />
      <div className="space-y-3 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
    </div>
  );
}
