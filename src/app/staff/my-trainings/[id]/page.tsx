'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Video, FileQuestion, CheckCircle2, Clock, Play, Target,
  Calendar, BookOpen, Award, ChevronRight, Lock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { Chip } from './_components/chip';
import { Banner } from './_components/banner';

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

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="td-empty">
        <div className="td-empty-icon"><AlertTriangle className="h-6 w-6" /></div>
        <h2>
          {error === 'Eğitim ataması bulunamadı' || error.includes('not found') || error.includes('404')
            ? 'Eğitime erişilemiyor'
            : 'Eğitim yüklenemedi'}
        </h2>
        <p>
          {error === 'Eğitim ataması bulunamadı' || error.includes('not found') || error.includes('404')
            ? 'Bu eğitime erişim yetkiniz yok veya eğitim bulunamadı.'
            : error}
        </p>
        <div className="td-empty-actions">
          <Link href="/staff/my-trainings" className="td-empty-link">← Eğitimlerime Dön</Link>
          <button onClick={refetch} className="td-empty-link td-empty-link-strong">
            <RefreshCw className="h-3 w-3" /> Tekrar Dene
          </button>
        </div>
        <style>{`
          .td-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .td-empty-icon { width: 56px; height: 56px; border-radius: 999px; background: #fdf5f2; color: #b3261e; display: flex; align-items: center; justify-content: center; }
          .td-empty h2 { font-family: var(--font-editorial, serif); font-size: 20px; color: #0a0a0a; margin: 0; }
          .td-empty p { font-size: 13px; color: #6b6a63; margin: 0; }
          .td-empty-actions { display: flex; gap: 20px; margin-top: 6px; }
          .td-empty-link { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 600; color: #6b6a63; text-decoration: none; background: none; border: none; cursor: pointer; }
          .td-empty-link-strong { color: #0a0a0a; }
          .td-empty-link:hover { color: #0a7a47; }
        `}</style>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="td-empty">
        <p>Eğitim bulunamadı.</p>
      </div>
    );
  }

  const videos = training.videos ?? [];
  const completedVideos = videos.filter(v => v.completed).length;
  const videoProgress = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

  const isExamOnly = training.examOnly === true;
  const isRetry = !isExamOnly && ((training.currentAttempt ?? 0) > 1 || !!training.needsRetry);

  const currentStep = isExamOnly
    ? (!training.postExamCompleted ? 0 : 1)
    : isRetry
      ? (!training.videosCompleted ? 0 : !training.postExamCompleted ? 1 : 2)
      : (!training.preExamCompleted ? 0 : !training.videosCompleted ? 1 : !training.postExamCompleted ? 2 : 3);
  const totalSteps = isExamOnly ? 1 : isRetry ? 2 : 3;
  const completedSteps = currentStep;
  const overallProgress = Math.round((completedSteps / totalSteps) * 100);
  const allDone = isExamOnly ? currentStep >= 1 : isRetry ? currentStep >= 2 : currentStep >= 3;

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
    <div className="td-page">
      {/* ═══════ Editorial Hero ═══════ */}
      <section className="td-hero">
        <button onClick={() => router.back()} className="td-back" aria-label="Geri dön">
          <ArrowLeft className="h-4 w-4" />
          <span>Eğitimlerim</span>
        </button>

        <div className="td-hero-meta">
          <span className="td-eyebrow">{training.category || 'Eğitim'}</span>
          <span className="td-attempt">
            Deneme <strong>{Math.max(training.currentAttempt ?? 0, 1).toString().padStart(2, '0')}</strong>/<strong>{(training.maxAttempts ?? 3).toString().padStart(2, '0')}</strong>
          </span>
        </div>

        <h1 className="td-title">{training.title}</h1>
        {training.description && <p className="td-desc">{training.description}</p>}

        <div className="td-chips">
          <Chip icon={<Calendar className="h-3 w-3" />} label="Son tarih" value={training.deadline || '—'} />
          <Chip icon={<Clock className="h-3 w-3" />} label="Süre" value={`${training.examDuration ?? 30} dk`} />
          <Chip icon={<Target className="h-3 w-3" />} label="Geçme" value={`%${training.passingScore ?? 70}`} />
        </div>

        <div className="td-progress">
          <div className="td-progress-bar">
            <div className="td-progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <span className="td-progress-text">
            <strong>{completedSteps.toString().padStart(2, '0')}</strong>/<strong>{totalSteps.toString().padStart(2, '0')}</strong> aşama
          </span>
        </div>
      </section>

      {/* Expired banner */}
      {training.isExpired && !allDone && (
        <Banner tone="err" icon={<AlertTriangle className="h-4 w-4" />}>
          <h3>Bu eğitimin süresi dolmuş</h3>
          <p>Eğitim süresi <strong>{training.deadline}</strong> tarihinde sona erdi. Sınava giriş yapılamaz.</p>
        </Banner>
      )}

      {/* Retry banner */}
      {isRetry && training.status !== 'failed' && !training.isExpired && (
        <Banner tone="amber" icon={<RefreshCw className="h-4 w-4" />}>
          <h3><em>{training.currentAttempt}.</em> deneme hakkındasın</h3>
          <p>
            {training.lastAttemptScore !== undefined && `Önceki deneme puanı: %${training.lastAttemptScore}. `}
            Ön sınav atlandı. Videoları izleyip son sınava gir. (Toplam {training.maxAttempts} hak)
          </p>
        </Banner>
      )}

      {/* ═══════ Steps timeline ═══════ */}
      <section className="td-steps">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStep && !allDone;
          const isDone = step.done;
          const isLocked = idx > currentStep;
          const StepIcon = step.icon;
          return (
            <div
              key={idx}
              className={`td-step ${isDone ? 'td-step-done' : isCurrent ? 'td-step-current' : isLocked ? 'td-step-locked' : ''}`}
            >
              <div className="td-step-num">
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : isLocked ? <Lock className="h-4 w-4" /> : <StepIcon className="h-5 w-5" />}
              </div>
              <div className="td-step-body">
                <span className="td-step-eyebrow">Aşama {(idx + 1).toString().padStart(2, '0')}</span>
                <h3>{step.label}</h3>
                <p>{step.desc}</p>
                {'score' in step && step.score !== undefined && isDone && (
                  <span className="td-step-score">Puan: %{step.score}</span>
                )}
              </div>
              {idx < steps.length - 1 && <span className="td-step-connector" aria-hidden />}
            </div>
          );
        })}
      </section>

      {/* ═══════ Video list (after pre-exam OR retry) ═══════ */}
      {(training.preExamCompleted || isRetry) && videos.length > 0 && !allDone && (
        <section className="td-videos">
          <header className="td-videos-head">
            <div>
              <span className="td-card-eyebrow">İçerik</span>
              <h3 className="td-card-title">Eğitim Videoları</h3>
            </div>
            <div className="td-videos-progress">
              <div className="td-videos-bar">
                <div className="td-videos-bar-fill" style={{ width: `${videoProgress}%` }} />
              </div>
              <span className="td-videos-pct">
                <strong>{completedVideos.toString().padStart(2, '0')}</strong>/<strong>{videos.length.toString().padStart(2, '0')}</strong>
              </span>
            </div>
          </header>

          <ul className="td-videos-list">
            {videos.map((v, i) => {
              const isNext = !v.completed && i === completedVideos;
              const isLocked = !v.completed && !isNext;
              return (
                <li
                  key={i}
                  className={`td-video ${v.completed ? 'td-video-done' : isNext ? 'td-video-next' : 'td-video-locked'}`}
                >
                  <span className="td-video-num">
                    {v.completed ? <CheckCircle2 className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="td-video-body">
                    <h4>{v.title}</h4>
                    <p><Clock className="h-3 w-3" /> {v.duration}</p>
                  </div>
                  {v.completed ? (
                    <span className="td-video-chip">Tamamlandı</span>
                  ) : isNext ? (
                    <Link href={`/exam/${examId}/videos`} className="td-video-cta">
                      <Play className="h-3.5 w-3.5" fill="currentColor" />
                      <span>İzle</span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {training.videosCompleted && !training.postExamCompleted && (
            <div className="td-videos-done">
              <Award className="h-5 w-5" />
              <div>
                <h4>Tüm videolar tamamlandı</h4>
                <p>Son sınava geçebilirsin.</p>
              </div>
              <Link href={`/exam/${examId}/post-exam`} className="td-btn td-btn-primary">
                <Award className="h-4 w-4" />
                <span>Son Sınav</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ═══════ Primary CTA ═══════ */}
      {!allDone && !training.isExpired && (
        <Link href={ctaHref} className="td-main-cta">
          <CtaIcon className="h-5 w-5" />
          <span>{ctaLabel}</span>
          <ChevronRight className="h-4 w-4 td-main-cta-chev" />
        </Link>
      )}

      {/* ═══════ Passed state ═══════ */}
      {training.status === 'passed' && (
        <div className="td-passed">
          <div className="td-passed-hero">
            <div className="td-passed-icon">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="td-card-eyebrow">Tamamlandı</span>
              <h2 className="td-passed-title">Eğitim başarıyla tamamlandı</h2>
              {training.lastAttemptScore !== undefined && (
                <p className="td-passed-meta">
                  Son sınav puanı <strong>%{training.lastAttemptScore}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="td-passed-actions">
            {videos.length > 0 && (
              <Link href={`/exam/${examId}/videos?mode=review`} className="td-action">
                <span className="td-action-icon td-action-icon-ink">
                  <Play className="h-4 w-4" fill="currentColor" />
                </span>
                <div className="td-action-body">
                  <h4>Eğitim İçeriğini Tekrar İzle</h4>
                  <p>{videos.length} video · istediğin zaman tekrar izle</p>
                </div>
                <ChevronRight className="h-4 w-4 td-action-chev" />
              </Link>
            )}

            <Link href="/staff/certificates" className="td-action">
              <span className="td-action-icon td-action-icon-ok">
                <Award className="h-4 w-4" />
              </span>
              <div className="td-action-body">
                <h4>Sertifikalarıma Git</h4>
                <p>Başarı sertifikana ulaş</p>
              </div>
              <ChevronRight className="h-4 w-4 td-action-chev" />
            </Link>
          </div>
        </div>
      )}

      {/* ═══════ Failed state ═══════ */}
      {allDone && training.status === 'failed' && (
        <div className="td-failed">
          <div className="td-failed-icon"><Lock className="h-6 w-6" /></div>
          <h3>Tüm deneme hakları tükendi</h3>
          <p>{training.maxAttempts} deneme hakkının tamamını kullandın. Ek deneme için eğitim yöneticine başvur.</p>
          <Link href="/staff/my-trainings" className="td-failed-link">← Eğitimlerime Dön</Link>
        </div>
      )}

      <style jsx>{`
        .td-page {
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-bottom: 60px;
        }

        /* ── Hero ── */
        .td-hero {
          padding: 28px 32px 32px;
          background: linear-gradient(135deg, #faf8f2 0%, #f4efdf 100%);
          border: 1px solid #ebe7df;
          border-radius: 20px;
          position: relative;
          overflow: hidden;
        }
        .td-hero::before {
          content: '';
          position: absolute;
          top: -40%;
          right: -15%;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(10, 122, 71, 0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .td-hero::after {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #0a7a47;
        }
        .td-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px 0 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.6);
          color: #6b6a63;
          border: none;
          cursor: pointer;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
          transition: background 160ms ease, color 160ms ease;
        }
        .td-back:hover { background: #0a0a0a; color: #fafaf7; }

        .td-hero-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          position: relative;
          z-index: 1;
        }
        .td-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8a8578;
        }
        .td-attempt {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
        }
        .td-attempt strong {
          font-family: var(--font-editorial, serif);
          font-weight: 500;
          color: #0a0a0a;
        }
        .td-title {
          font-family: var(--font-editorial, serif);
          font-size: clamp(26px, 4vw, 40px);
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.025em;
          line-height: 1.1;
          margin: 0 0 10px;
          position: relative;
          z-index: 1;
        }
        .td-desc {
          font-size: 14px;
          color: #6b6a63;
          line-height: 1.6;
          margin: 0 0 18px;
          position: relative;
          z-index: 1;
          max-width: 560px;
        }
        .td-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .td-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .td-progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(10, 10, 10, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }
        .td-progress-fill {
          height: 100%;
          background: #0a7a47;
          transition: width 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-progress-text {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .td-progress-text strong {
          color: #0a0a0a;
          font-weight: 600;
          font-family: var(--font-editorial, serif);
        }

        /* ── Steps timeline ── */
        .td-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 8px 0;
        }
        .td-step {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          padding: 16px 0;
          position: relative;
        }
        .td-step-connector {
          position: absolute;
          left: 21px;
          top: 62px;
          bottom: -8px;
          width: 2px;
          background: #ebe7df;
          border-radius: 1px;
        }
        .td-step-done .td-step-connector { background: #0a7a47; }
        .td-step-num {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #faf8f2;
          color: #6b6a63;
          border: 1px solid #ebe7df;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }
        .td-step-done .td-step-num {
          background: #0a7a47;
          color: #fafaf7;
          border-color: #0a7a47;
        }
        .td-step-current .td-step-num {
          background: #0a0a0a;
          color: #fafaf7;
          border-color: #0a0a0a;
          box-shadow: 0 0 0 4px rgba(10, 10, 10, 0.06);
        }
        .td-step-locked { opacity: 0.55; }
        .td-step-body { padding-top: 4px; min-width: 0; }
        .td-step-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 2px;
        }
        .td-step-body h3 {
          font-family: var(--font-editorial, serif);
          font-size: 17px;
          font-weight: 500;
          font-variation-settings: 'opsz' 30, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .td-step-body p {
          font-size: 12px;
          color: #6b6a63;
          margin: 0;
        }
        .td-step-score {
          display: inline-block;
          margin-top: 6px;
          padding: 3px 9px;
          border-radius: 999px;
          background: #eaf6ef;
          color: #0a7a47;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        /* ── Videos card ── */
        .td-videos {
          padding: 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .td-videos-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px dashed #ebe7df;
        }
        .td-card-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 2px;
        }
        .td-card-title {
          font-family: var(--font-editorial, serif);
          font-size: 18px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.01em;
          margin: 0;
        }
        .td-videos-progress { display: flex; align-items: center; gap: 10px; }
        .td-videos-bar {
          width: 80px;
          height: 4px;
          background: #ebe7df;
          border-radius: 2px;
          overflow: hidden;
        }
        .td-videos-bar-fill {
          height: 100%;
          background: #0a7a47;
          transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-videos-pct {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .td-videos-pct strong {
          color: #0a0a0a;
          font-family: var(--font-editorial, serif);
          font-weight: 500;
        }
        .td-videos-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .td-video {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #ebe7df;
          background: #ffffff;
          transition: border-color 180ms ease, background 180ms ease;
        }
        .td-video-done { background: #f7fcf8; border-color: #c8e6d5; }
        .td-video-next { background: #faf8f2; border-color: #0a0a0a; }
        .td-video-locked { opacity: 0.55; }
        .td-video-num {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #faf8f2;
          color: #6b6a63;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .td-video-done .td-video-num { background: #0a7a47; color: #fafaf7; }
        .td-video-next .td-video-num { background: #0a0a0a; color: #fafaf7; }
        .td-video-body { min-width: 0; }
        .td-video-body h4 {
          font-family: var(--font-editorial, serif);
          font-size: 14px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a0a0a;
          margin: 0 0 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .td-video-body p {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #6b6a63;
          margin: 0;
          font-variant-numeric: tabular-nums;
        }
        .td-video-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          background: #eaf6ef;
          color: #0a7a47;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .td-video-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: #0a0a0a;
          color: #fafaf7;
          text-decoration: none;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          transition: background 160ms ease;
        }
        .td-video-cta:hover { background: #1a1a1a; }

        .td-videos-done {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 16px;
          padding: 14px 16px;
          background: #fef6e7;
          border: 1px solid #e9c977;
          border-radius: 12px;
        }
        .td-videos-done :global(svg) { color: #b4820b; flex-shrink: 0; }
        .td-videos-done > div { flex: 1; min-width: 0; }
        .td-videos-done h4 {
          font-family: var(--font-editorial, serif);
          font-size: 14px;
          font-weight: 500;
          color: #6a4e11;
          margin: 0 0 2px;
        }
        .td-videos-done p { font-size: 11px; color: #8a5a11; margin: 0; }

        /* ── Primary CTA ── */
        .td-main-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 56px;
          padding: 0 24px;
          border-radius: 999px;
          background: #0a0a0a;
          color: #fafaf7;
          font-family: var(--font-display, system-ui);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.005em;
          text-decoration: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 6px 20px rgba(10, 10, 10, 0.15);
          transition: background 160ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-main-cta:hover { background: #1a1a1a; }
        .td-main-cta:active { transform: scale(0.98); }
        .td-main-cta-chev { transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        .td-main-cta:hover .td-main-cta-chev { transform: translateX(3px); }

        /* ── Buttons ── */
        .td-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-btn:active { transform: scale(0.97); }
        .td-btn-primary {
          background: #b4820b;
          color: #fafaf7;
        }
        .td-btn-primary:hover { background: #8f6709; }

        /* ── Passed state ── */
        .td-passed { display: flex; flex-direction: column; gap: 18px; }
        .td-passed-hero {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 22px 24px;
          background: linear-gradient(135deg, #f7fcf8 0%, #eaf6ef 100%);
          border: 1px solid #c8e6d5;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }
        .td-passed-hero::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #0a7a47;
        }
        .td-passed-icon {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          background: #0a7a47;
          color: #fafaf7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .td-passed-title {
          font-family: var(--font-editorial, serif);
          font-size: 22px;
          font-weight: 500;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .td-passed-meta {
          font-size: 13px;
          color: #6b6a63;
          margin: 4px 0 0;
        }
        .td-passed-meta strong {
          font-family: var(--font-editorial, serif);
          font-weight: 500;
          color: #0a7a47;
          font-variant-numeric: tabular-nums;
        }
        .td-passed-actions { display: flex; flex-direction: column; gap: 10px; }

        /* Action cards */
        .td-action {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 14px;
          text-decoration: none;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-action:hover {
          border-color: #0a0a0a;
          transform: translateY(-1px);
        }
        .td-action-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .td-action-icon-ink { background: #0a0a0a; color: #fafaf7; }
        .td-action-icon-ok { background: #eaf6ef; color: #0a7a47; }
        .td-action-body { flex: 1; min-width: 0; }
        .td-action-body h4 {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a0a0a;
          margin: 0 0 2px;
        }
        .td-action-body p {
          font-size: 12px;
          color: #6b6a63;
          margin: 0;
        }
        .td-action-chev {
          color: #8a8578;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .td-action:hover .td-action-chev { transform: translateX(3px); color: #0a0a0a; }

        /* ── Failed state ── */
        .td-failed {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 20px;
          gap: 12px;
        }
        .td-failed-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: #fdf5f2;
          color: #b3261e;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .td-failed h3 {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          color: #b3261e;
          margin: 0;
        }
        .td-failed p {
          font-size: 13px;
          color: #6b6a63;
          max-width: 400px;
          line-height: 1.55;
          margin: 0;
        }
        .td-failed-link {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          color: #0a0a0a;
          text-decoration: none;
          margin-top: 6px;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .td-hero { padding: 22px 22px 24px; }
          .td-videos { padding: 20px; }
          .td-videos-head { flex-direction: column; align-items: flex-start; gap: 10px; padding-bottom: 14px; }
          .td-video { gap: 12px; padding: 10px 12px; }
          .td-video-body h4 { font-size: 13px; }
          .td-videos-done { flex-wrap: wrap; }
          .td-videos-done .td-btn { width: 100%; justify-content: center; }
          .td-passed-hero { padding: 20px 22px; }
          .td-passed-title { font-size: 18px; }
          .td-main-cta { height: 52px; padding: 0 20px; font-size: 14px; }
        }
      `}</style>
    </div>
  );
}

