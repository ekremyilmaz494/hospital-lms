'use client';

import { useState, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  BookOpen, Clock, CheckCircle2, Lock, Play, ArrowRight, ClipboardCheck,
  AlertOctagon, Stethoscope, HeartPulse, Activity, ShieldCheck, Microscope,
  FlaskConical, Syringe, Scale, Award, BookOpenText, TrendingUp, Hash,
  CalendarDays, ChevronRight, Target, Flame,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { MandatoryFeedbackBanner } from '@/components/shared/mandatory-feedback-banner';

interface Training {
  id: string;
  title: string;
  category: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  deadline: string;
  progress: number;
  daysLeft?: number;
  score?: number;
  examOnly?: boolean;
  questionCount?: number;
  examDurationMinutes?: number;
  passingScore?: number;
}

/* ─────────────────────────────────────────────────────────────
   KLİNİK PALET — proje CSS değişkenlerine bağlı tema tokenları.
   Dekoratif değil; her renk bir klinik anlam taşır (triyaj kodu).
   ───────────────────────────────────────────────────────────── */
const C = {
  surface:    'var(--color-surface)',
  bg:         'var(--color-bg)',
  border:     'var(--color-border)',
  text:       'var(--color-text)',
  textMuted:  'var(--color-text-muted)',
  // Triyaj renkleri (sol kenar şeritleri için)
  primary:    'var(--color-primary)',
  primaryLt:  'var(--color-primary-light)',
  primaryDk:  'var(--brand-800)',
  success:    'var(--color-success)',
  successBg:  'var(--color-success-bg)',
  warning:    'var(--color-warning)',
  warningBg:  'var(--color-warning-bg)',
  error:      'var(--color-error)',
  errorBg:    'var(--color-error-bg)',
  accent:     'var(--color-accent)',
  accentLt:   'var(--color-accent-light)',
} as const;

/* Kategori → klinik ikon eşlemesi (Türkçe anahtarlar) */
const categoryIcon = (category: string): LucideIcon => {
  const k = (category || '').toLowerCase();
  if (k.includes('enfeksiyon')) return Microscope;
  if (k.includes('hasta') || k.includes('hak')) return HeartPulse;
  if (k.includes('radyoloji')) return Activity;
  if (k.includes('güvenl') || k.includes('guvenl') || k.includes('osha')) return ShieldCheck;
  if (k.includes('kvkk') || k.includes('veri')) return ShieldCheck;
  if (k.includes('laboratuv') || k.includes('laboratuar')) return FlaskConical;
  if (k.includes('ilk yardım') || k.includes('ilaç')) return Syringe;
  if (k.includes('etik') || k.includes('hukuk')) return Scale;
  if (k.includes('tıbbi') || k.includes('klinik')) return Stethoscope;
  return BookOpenText;
};

type StatusKey = 'assigned' | 'in_progress' | 'passed' | 'failed' | 'locked';
const statusLabel: Record<StatusKey, string> = {
  assigned: 'Atandı',
  in_progress: 'Devam Ediyor',
  passed: 'Başarılı',
  failed: 'Başarısız',
  locked: 'Kilitli',
};

export default function MyTrainingsPage() {
  const { data: rawData, isLoading, error } =
    useFetch<{ data: Training[] } | Training[]>('/api/staff/my-trainings');
  const [activeTab, setActiveTab] = useState<'trainings' | 'exams'>('trainings');

  const allItems: Training[] = useMemo(
    () => (Array.isArray(rawData) ? rawData : (rawData as { data: Training[] })?.data ?? []),
    [rawData]
  );

  const {
    trainingList, examCount, trainingCount,
    activeTrainings, exhaustedTrainings, completedTrainings, lockedTrainings,
    totalCount, activeCount, completedCount, averageScore, urgentCount,
  } = useMemo(() => {
    const list = allItems.filter((t) => (activeTab === 'exams' ? t.examOnly : !t.examOnly));
    const isExhaustedFailed = (t: Training) =>
      t.status === 'failed' && t.attempt >= t.maxAttempts;
    const active = list.filter(
      (t) =>
        (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'failed') &&
        !isExhaustedFailed(t)
    );
    const exhausted = list.filter(isExhaustedFailed);
    const completed = list.filter((t) => t.status === 'passed');
    const lockedList = list.filter((t) => t.status === 'locked');
    const passed = completed.length;
    const scores = list.filter((t) => t.score).map((t) => t.score!);
    const avg = scores.length
      ? `%${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`
      : '—';
    const urgent = active.filter((t) => t.daysLeft !== undefined && t.daysLeft <= 3).length;

    return {
      trainingList: list,
      examCount: allItems.filter((t) => t.examOnly).length,
      trainingCount: allItems.filter((t) => !t.examOnly).length,
      activeTrainings: active,
      exhaustedTrainings: exhausted,
      completedTrainings: completed,
      lockedTrainings: lockedList,
      totalCount: list.length,
      activeCount: active.length,
      completedCount: passed,
      averageScore: avg,
      urgentCount: urgent,
    };
  }, [allItems, activeTab]);

  if (isLoading) return <TrainingsSkeleton />;
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4">
        <div className="text-center max-w-sm">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
            style={{ background: C.errorBg }}
          >
            <AlertOctagon className="h-6 w-6" style={{ color: C.error }} />
          </div>
          <p className="text-[14px] font-bold mb-1" style={{ color: C.error }}>
            Eğitimler yüklenemedi
          </p>
          <p className="text-[12px]" style={{ color: C.textMuted }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pb-24 sm:pb-8"
      style={{
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <MandatoryFeedbackBanner />

      {/* ═══════ HEADER — editorial, az dekoratif ═══════ */}
      <BlurFade delay={0}>
        <header className="mb-5 sm:mb-7">
          <div className="flex items-end justify-between gap-3 mb-1">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase"
              style={{ color: C.textMuted }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: C.success }}
                aria-hidden
              />
              EĞİTİM PORTALI
            </span>
            {urgentCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: C.warningBg, color: C.warning }}
              >
                <Flame className="h-3 w-3" />
                {urgentCount} acil
              </span>
            )}
          </div>
          <h1
            className="text-[28px] sm:text-[36px] font-black tracking-[-0.025em] leading-[1.05]"
            style={{ color: C.text, fontFamily: 'var(--font-display)' }}
          >
            Eğitimlerim
          </h1>
          <p
            className="text-[12.5px] sm:text-[13.5px] mt-1.5 max-w-xl leading-relaxed"
            style={{ color: C.textMuted }}
          >
            Atanan eğitimleri tamamla, sınavlardan geç, sertifikalarını topla.
          </p>
        </header>
      </BlurFade>

      {/* ═══════ KPI ŞERİTİ — clinical metric strip ═══════ */}
      <BlurFade delay={0.04}>
        <section
          className="mb-5 sm:mb-7 rounded-2xl overflow-hidden"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 0 rgba(2,36,31,0.02)',
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
            style={{ borderColor: C.border }}
          >
            <Kpi icon={BookOpen}     label="Toplam Eğitim" value={totalCount.toString()} accent={C.primary} />
            <Kpi icon={Clock}        label="Devam Eden"    value={activeCount.toString()} accent={C.accent} />
            <Kpi icon={CheckCircle2} label="Tamamlanan"    value={completedCount.toString()} accent={C.success} />
            <Kpi icon={TrendingUp}   label="Ortalama Puan" value={averageScore} accent={C.primaryDk} highlight />
          </div>
        </section>
      </BlurFade>

      {/* ═══════ TAB SWITCHER — underline editorial, ARIA tablist ═══════ */}
      <BlurFade delay={0.06}>
        <div
          role="tablist"
          aria-label="Eğitim tipi filtresi"
          className="flex items-center gap-1 mb-5 sm:mb-7 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          {([
            { id: 'trainings' as const, label: 'Eğitimler', count: trainingCount, Icon: BookOpen },
            { id: 'exams' as const, label: 'Sınavlar', count: examCount, Icon: ClipboardCheck },
          ]).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className="relative inline-flex items-center gap-2 px-3 sm:px-4 min-h-11 text-[13px] font-bold whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-t-md"
                style={{
                  color: isActive ? C.primary : C.textMuted,
                  ['--tw-ring-color' as string]: C.primary,
                }}
              >
                <tab.Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold leading-none"
                  style={{
                    background: isActive ? C.primaryLt : C.bg,
                    color: isActive ? C.primary : C.textMuted,
                  }}
                  aria-label={`${tab.count} adet`}
                >
                  {tab.count}
                </span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-px h-[2px]"
                    style={{ background: C.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* ═══════ AKTİF EĞİTİMLER — clinical chart card ═══════ */}
      {activeTrainings.length > 0 && (
        <Section title="Aktif Eğitimler" count={activeTrainings.length} accent={C.primary} delay={0.08}>
          <div className="space-y-2.5">
            {activeTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.1 + i * 0.03}>
                <ActiveCard training={t} />
              </BlurFade>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ TAMAMLANAN — bento (asimetrik) ═══════ */}
      {completedTrainings.length > 0 && (
        <Section
          title="Tamamlanan Eğitimler"
          count={completedTrainings.length}
          accent={C.success}
          delay={0.12}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {completedTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.14 + i * 0.025}>
                <CompletedCard training={t} />
              </BlurFade>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ BAŞARISIZ — kırmızı sol şeritli arşiv ═══════ */}
      {exhaustedTrainings.length > 0 && (
        <Section
          title="Başarısız Eğitimler"
          count={exhaustedTrainings.length}
          accent={C.error}
          delay={0.16}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {exhaustedTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.18 + i * 0.025}>
                <ArchiveCard training={t} variant="failed" />
              </BlurFade>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ KİLİTLİ — amber sol şeritli arşiv ═══════ */}
      {lockedTrainings.length > 0 && (
        <Section
          title="Kilitlenmiş Eğitimler"
          count={lockedTrainings.length}
          accent={C.accent}
          delay={0.2}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {lockedTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.22 + i * 0.025}>
                <ArchiveCard training={t} variant="locked" />
              </BlurFade>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ EMPTY ═══════ */}
      {trainingList.length === 0 && (
        <BlurFade delay={0.1}>
          <div
            className="text-center py-16 sm:py-24 rounded-2xl"
            style={{ background: C.surface, border: `1px dashed ${C.border}` }}
          >
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
              style={{ background: C.primaryLt }}
            >
              <BookOpen className="h-6 w-6" style={{ color: C.primary }} strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-bold mb-1" style={{ color: C.text }}>
              Henüz {activeTab === 'exams' ? 'sınav' : 'eğitim'} atanmadı
            </p>
            <p className="text-[12px] max-w-xs mx-auto" style={{ color: C.textMuted }}>
              Yöneticiniz size {activeTab === 'exams' ? 'bir sınav' : 'bir eğitim'} atadığında
              burada görünecek.
            </p>
          </div>
        </BlurFade>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function Kpi({
  icon: Icon, label, value, accent, highlight = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="px-4 py-4 sm:px-5 sm:py-5 relative"
      style={{
        borderColor: C.border,
        background: highlight ? `linear-gradient(180deg, ${accent}06 0%, transparent 100%)` : 'transparent',
      }}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.textMuted }}
        >
          {label}
        </span>
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={2.25} />
      </div>
      <div
        className="text-[24px] sm:text-[28px] font-black leading-none tracking-tight"
        style={{ color: C.text, fontFamily: 'var(--font-display)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title, count, accent, delay = 0, children,
}: {
  title: string;
  count: number;
  accent: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7 sm:mb-9">
      <BlurFade delay={delay}>
        <div className="flex items-baseline gap-3 mb-3 sm:mb-4">
          <span
            aria-hidden
            className="block w-1 h-5 rounded-full"
            style={{ background: accent }}
          />
          <h2
            className="text-[15px] sm:text-[17px] font-black tracking-tight"
            style={{ color: C.text }}
          >
            {title}
          </h2>
          <span
            className="text-[11px] font-mono font-bold rounded-full px-2 py-0.5"
            style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }}
          >
            {count}
          </span>
        </div>
      </BlurFade>
      {children}
    </section>
  );
}

function ActiveCard({ training: t }: { training: Training }) {
  const Icon = categoryIcon(t.category);
  const isUrgent = t.daysLeft !== undefined && t.daysLeft <= 3;
  const isStarted = t.status === 'in_progress' || t.progress > 0;
  const isFailedRetry = t.status === 'failed';
  const accent = isFailedRetry ? C.warning : isUrgent ? C.error : isStarted ? C.accent : C.primary;
  const status = statusLabel[t.status as StatusKey] ?? t.status;

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="block group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ ['--tw-ring-color' as string]: accent }}
      aria-label={`${t.title} eğitimi · Durum: ${status} · Kategori: ${t.category || 'Genel'}${isUrgent ? ` · Son ${t.daysLeft} gün` : ''}`}
    >
      <article
        className="relative overflow-hidden rounded-xl transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-active:translate-y-0"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 2px rgba(2,36,31,0.04)',
        }}
      >
        {/* Sol triyaj şeridi — status'a göre renk */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: accent }}
        />

        {/* İçerik — mobile vertical, sm+ horizontal */}
        <div className="pl-4 pr-4 py-4 sm:pl-5 sm:pr-5 sm:py-5">
          {/* Top meta row */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ background: `${accent}15`, color: accent }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: accent }}
                aria-hidden
              />
              {status}
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: C.textMuted }}>
              {t.category || 'Genel'}
            </span>
            {isUrgent && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: C.errorBg, color: C.error }}
              >
                <Flame className="h-2.5 w-2.5" />
                Son {t.daysLeft} gün
              </span>
            )}
          </div>

          {/* Title row — icon + title side by side */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `${accent}10`,
                border: `1px solid ${accent}25`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3
                className="text-[14px] sm:text-[15px] font-black leading-[1.25] tracking-tight"
                style={{ color: C.text }}
              >
                {t.title}
              </h3>
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: C.textMuted }}>
                <CalendarDays className="inline h-3 w-3 -mt-0.5 mr-1" />
                Bitiş: <span style={{ color: isUrgent ? C.error : C.text, fontWeight: 700 }}>{t.deadline || '—'}</span>
              </p>
            </div>
          </div>

          {/* Progress bar — sadece progress > 0 ise */}
          {isStarted && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.textMuted }}>
                  İlerleme
                </span>
                <span className="text-[11px] font-mono font-bold" style={{ color: accent }}>
                  %{t.progress}
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${t.progress}%`, background: accent }}
                />
              </div>
            </div>
          )}

          {/* Stats grid + CTA — bottom (mobile: wrap CTA below if cramped) */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
            <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4 text-[11px] font-mono" style={{ color: C.textMuted }}>
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span style={{ color: C.text, fontWeight: 700 }}>{Math.max(t.attempt, 1)}</span>/{t.maxAttempts}
              </div>
              {t.examOnly ? (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span style={{ color: C.text, fontWeight: 700 }}>{t.examDurationMinutes ?? '—'}</span>dk
                </div>
              ) : t.daysLeft !== undefined ? (
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  <span style={{ color: isUrgent ? C.error : C.text, fontWeight: 700 }}>{t.daysLeft}</span>g kaldı
                </div>
              ) : t.questionCount ? (
                <div className="flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" />
                  <span style={{ color: C.text, fontWeight: 700 }}>{t.questionCount}</span> soru
                </div>
              ) : null}
            </dl>
            <span
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 min-h-11 min-w-11 text-[12.5px] font-bold transition-colors"
              style={{
                background: accent,
                color: '#ffffff',
                boxShadow: `0 1px 0 ${accent}40`,
              }}
              aria-hidden
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
              <span>{isStarted || isFailedRetry ? 'Devam' : 'Başla'}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CompletedCard({ training: t }: { training: Training }) {
  const Icon = categoryIcon(t.category);
  const score = t.score ?? 0;
  const scoreColor = score >= 85 ? C.success : score >= 70 ? C.primary : score >= 60 ? C.accent : C.error;
  const scoreTier = score >= 95 ? 'Mükemmel' : score >= 85 ? 'Yüksek' : score >= 70 ? 'İyi' : score >= 60 ? 'Orta' : 'Düşük';
  const isTop = score >= 95;

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="block group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ ['--tw-ring-color' as string]: C.primary }}
      aria-label={`${t.title} eğitimi · Tamamlandı · Skor: %${score} (${scoreTier})`}
    >
      <article
        className="rounded-xl p-4 sm:p-5 h-full flex flex-col transition-[transform,box-shadow,border-color] duration-300 group-hover:-translate-y-0.5"
        style={{
          background: C.surface,
          border: `1px solid ${isTop ? `${C.success}40` : C.border}`,
          boxShadow: isTop
            ? `0 4px 14px -8px ${C.success}50, 0 1px 0 rgba(0,0,0,0.02)`
            : '0 1px 2px rgba(2,36,31,0.04)',
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ background: C.successBg }}
          >
            <Icon className="h-4 w-4" style={{ color: C.success }} strokeWidth={2} />
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {isTop && <Award className="h-3.5 w-3.5" style={{ color: C.accent }} aria-hidden />}
              <span
                className="text-[22px] font-black leading-none font-mono"
                style={{ color: scoreColor }}
                aria-hidden
              >
                %{score}
              </span>
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.16em] mt-0.5 block"
              style={{ color: scoreColor }}
              aria-hidden
            >
              {scoreTier}
            </span>
          </div>
        </div>

        {/* Title */}
        <h4
          className="text-[13.5px] font-black leading-[1.3] tracking-tight mb-2 line-clamp-2 flex-1"
          style={{ color: C.text }}
        >
          {t.title}
        </h4>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[10.5px] font-mono mb-3" style={{ color: C.textMuted }}>
          <span className="font-bold uppercase tracking-[0.12em]">{t.category || 'Genel'}</span>
          {t.deadline && (
            <>
              <span aria-hidden>·</span>
              <span>{t.deadline}</span>
            </>
          )}
        </div>

        {/* Skor barı */}
        <div className="w-full h-[3px] rounded-full overflow-hidden mb-3" style={{ background: C.border }}>
          <div
            className="h-full rounded-full transition-[width] duration-1000"
            style={{ width: `${score}%`, background: scoreColor }}
          />
        </div>

        {/* CTA */}
        <div
          className="flex items-center justify-between text-[11.5px] font-bold pt-2"
          style={{ borderTop: `1px solid ${C.border}`, color: C.textMuted }}
        >
          <span>Detayları Görüntüle</span>
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: C.primary }}
          />
        </div>
      </article>
    </Link>
  );
}

function ArchiveCard({
  training: t,
  variant,
}: {
  training: Training;
  variant: 'failed' | 'locked';
}) {
  const isLocked = variant === 'locked';
  const accent = isLocked ? C.accent : C.error;
  const accentBg = isLocked ? C.accentLt : C.errorBg;
  const StateIcon = isLocked ? Lock : AlertOctagon;
  const stateLabel = isLocked ? 'Eğitim Kilitlendi' : 'Haklar Tükendi';
  const description = isLocked
    ? 'Bu eğitim yönetici tarafından kilitlenmiştir. Detaylar için akademik birim yöneticinize başvurunuz.'
    : `Bu eğitim için tanımlanan ${t.maxAttempts} deneme hakkının tamamı kullanılmıştır. Ek deneme hakkı için akademik birim yöneticinize başvurunuz.`;

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="block group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ ['--tw-ring-color' as string]: accent }}
      aria-label={`${t.title} eğitimi · ${stateLabel}`}
    >
      <article
        className="relative overflow-hidden rounded-xl p-4 sm:p-5 h-full transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 2px rgba(2,36,31,0.04)',
        }}
      >
        {/* Sol triyaj şeridi */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: accent }}
        />

        <div className="pl-3 sm:pl-4">
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
              style={{ background: accentBg }}
            >
              <StateIcon className="h-4.5 w-4.5" style={{ color: accent }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="text-[14px] font-black leading-[1.25] tracking-tight mb-0.5 line-clamp-2"
                style={{ color: C.text }}
              >
                {t.title}
              </h4>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: accent }}
              >
                {stateLabel}
              </span>
            </div>
            {!isLocked && t.score !== undefined && (
              <div className="text-right shrink-0 hidden sm:block">
                <div
                  className="text-[18px] font-black font-mono leading-none"
                  style={{ color: C.error }}
                >
                  %{t.score ?? 0}
                </div>
                <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] mt-0.5" style={{ color: C.textMuted }}>
                  Son skor
                </div>
              </div>
            )}
          </div>

          <p className="text-[12px] leading-relaxed mb-3" style={{ color: C.textMuted }}>
            {description}
          </p>

          <div
            className="flex items-center justify-between text-[11px] font-mono pt-3"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <span style={{ color: C.textMuted }}>
              {isLocked ? (t.category || 'Genel') : `Son tarih: ${t.deadline || '—'}`}
            </span>
            <span
              className="inline-flex items-center gap-1 font-bold transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ color: accent }}
              aria-hidden
            >
              Yöneticiye Başvur
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
   SKELETON — sayfa-spesifik shimmer placeholder.
   PageLoading global spinner yerine layout'u koruyarak yükle.
   ───────────────────────────────────────────────────────────── */
function TrainingsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Eğitimler yükleniyor"
      className="pb-24 sm:pb-8 motion-safe:animate-pulse"
      style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="mb-5 sm:mb-7">
        <div className="h-3 w-32 rounded mb-3" style={{ background: C.border }} />
        <div className="h-9 w-56 rounded mb-2" style={{ background: C.border }} />
        <div className="h-3 w-72 max-w-full rounded" style={{ background: C.border }} />
      </div>

      {/* KPI strip */}
      <div
        className="mb-5 sm:mb-7 rounded-2xl overflow-hidden grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderColor: C.border }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="h-2.5 w-20 rounded mb-3" style={{ background: C.border }} />
            <div className="h-7 w-16 rounded" style={{ background: C.border }} />
          </div>
        ))}
      </div>

      {/* Tab strip */}
      <div className="flex gap-3 mb-5 sm:mb-7" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="h-11 w-28 rounded-t" style={{ background: C.border }} />
        <div className="h-11 w-24 rounded-t" style={{ background: C.bg }} />
      </div>

      {/* Active card skeletons */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full" style={{ background: C.border }} />
          <div className="h-4 w-32 rounded" style={{ background: C.border }} />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 sm:p-5"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="flex gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg shrink-0" style={{ background: C.border }} />
                <div className="flex-1">
                  <div className="h-3 w-2/3 rounded mb-2" style={{ background: C.border }} />
                  <div className="h-2.5 w-1/3 rounded" style={{ background: C.border }} />
                </div>
                <div className="h-11 w-24 rounded-lg shrink-0" style={{ background: C.border }} />
              </div>
              <div className="h-1 w-full rounded-full" style={{ background: C.border }} />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Eğitimler yükleniyor, lütfen bekleyin.</span>
    </div>
  );
}
