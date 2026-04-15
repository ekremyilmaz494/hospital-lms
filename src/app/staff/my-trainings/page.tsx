'use client';

import { useState, useRef, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  BookOpen, BookOpenText, Clock, CheckCircle2, XCircle, Lock, Play,
  ArrowRight, ArrowUpRight, ChevronRight, ClipboardCheck, AlertOctagon,
  Library, Stethoscope, HeartPulse, Activity, ShieldCheck, Microscope,
  FlaskConical, Syringe, Scale, Sparkles, Award,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
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
   Tema — proje paletine bağlı (sage #0d9668 + amber #f59e0b)
   Mockup'ın layout yapısı korunur, renkler projenin CSS var'ları
   ───────────────────────────────────────────────────────────── */
const T = {
  // Yüzeyler — proje bg/surface
  bg:                  'var(--color-bg)',
  surfaceLowest:       'var(--color-surface)',
  surfaceLow:          'var(--color-bg)',
  surface:             'var(--color-surface)',
  surfaceHigh:         'var(--color-border)',
  // Primary — sage yeşili (mockup'ın forest green'i yerine)
  primary:             'var(--color-primary)',
  primaryContainer:    '#065f46',
  primaryDeep:         '#022c22',
  primaryFixed:        'var(--color-primary-light)',
  primaryFixedDim:     'rgba(13, 150, 104, 0.28)',
  onPrimaryContainer:  'rgba(255,255,255,0.88)',
  // Secondary — başarı yeşili (olive yerine)
  secondary:           'var(--color-success)',
  secondaryContainer:  'var(--color-success-bg)',
  secondaryFixed:      'var(--color-success-bg)',
  onSecondaryContainer:'var(--color-success)',
  // Tertiary — amber (gold yerine)
  tertiary:            'var(--color-accent)',
  tertiaryContainer:   'var(--color-accent-light)',
  tertiaryFixedDim:    'var(--color-accent)',
  // Error
  error:               'var(--color-error)',
  errorContainer:      'var(--color-error-bg)',
  onErrorContainer:    'var(--color-error)',
  // Typography
  onSurface:           'inherit',
  onSurfaceVariant:    'var(--color-text-muted)',
  outlineVariant:      'var(--color-border)',
} as const;

/* Category → representative clinical icon for hero panel */
const categoryIcon = (category: string): LucideIcon => {
  const key = (category || '').toLowerCase();
  if (key.includes('enfeksiyon')) return Microscope;
  if (key.includes('hasta') || key.includes('hak')) return HeartPulse;
  if (key.includes('radyoloji')) return Activity;
  if (key.includes('güvenl') || key.includes('guvenl') || key.includes('osha')) return ShieldCheck;
  if (key.includes('kvkk') || key.includes('veri')) return ShieldCheck;
  if (key.includes('laboratuv') || key.includes('laboratuar')) return FlaskConical;
  if (key.includes('ilk yardım') || key.includes('ilaç')) return Syringe;
  if (key.includes('etik') || key.includes('hukuk')) return Scale;
  if (key.includes('tıbbi') || key.includes('klinik')) return Stethoscope;
  return BookOpenText;
};

type StatusKey = 'assigned' | 'in_progress' | 'passed' | 'failed' | 'locked';
const statusLabel: Record<StatusKey, string> = {
  assigned: 'Atandı', in_progress: 'Devam Ediyor', passed: 'Başarılı', failed: 'Başarısız', locked: 'Kilitli',
};

export default function MyTrainingsPage() {
  const { data: rawData, isLoading, error } = useFetch<{ data: Training[] } | Training[]>('/api/staff/my-trainings');
  const [activeTab, setActiveTab] = useState<'trainings' | 'exams'>('trainings');
  const completedRef = useRef<HTMLDivElement>(null);

  const allItems: Training[] = useMemo(
    () => Array.isArray(rawData) ? rawData : (rawData as { data: Training[] })?.data ?? [],
    [rawData]
  );

  const {
    trainingList, examCount, trainingCount,
    activeTrainings, exhaustedTrainings, completedTrainings,
    totalCount, activeCount, completedCount, averageScore,
  } = useMemo(() => {
    const list = allItems.filter((t) => activeTab === 'exams' ? t.examOnly : !t.examOnly);
    const isExhaustedFailed = (t: Training) => t.status === 'failed' && t.attempt >= t.maxAttempts;
    const active = list.filter(t => (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'failed') && !isExhaustedFailed(t));
    const exhausted = list.filter(t => isExhaustedFailed(t));
    const completed = list.filter(t => t.status === 'passed' || t.status === 'locked');
    const passed = list.filter(t => t.status === 'passed').length;
    const scores = list.filter(t => t.score).map(t => t.score!);
    const avgScore = scores.length ? `%${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}` : '—';

    return {
      trainingList: list,
      examCount: allItems.filter((t) => t.examOnly).length,
      trainingCount: allItems.filter((t) => !t.examOnly).length,
      activeTrainings: active,
      exhaustedTrainings: exhausted,
      completedTrainings: completed,
      totalCount: list.length,
      activeCount: active.length,
      completedCount: passed,
      averageScore: avgScore,
    };
  }, [allItems, activeTab]);

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: T.error }}>{error}</div>
      </div>
    );
  }

  const scrollToCompleted = () =>
    completedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div
      style={{
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <MandatoryFeedbackBanner />

      {/* ═══════ PAGE HEADER ═══════ */}
      <BlurFade delay={0}>
        <header className="mb-10 sm:mb-14">
          <span
            className="text-[10px] font-extrabold tracking-[0.22em] uppercase mb-3 block"
            style={{ color: T.secondary }}
          >
            LMS · Eğitim Portalı
          </span>
          <h1
            className="text-[38px] sm:text-[60px] font-black tracking-[-0.03em] leading-[0.95] mb-4"
            style={{ color: T.primary }}
          >
            Eğitimlerim
          </h1>
          <p className="text-[14px] sm:text-[15px] leading-relaxed max-w-2xl" style={{ color: T.onSurfaceVariant }}>
            Atanan eğitimlerinizi takip edin, sertifikalarınızı görüntüleyin ve profesyonel gelişiminizi sürdürün.
          </p>
        </header>
      </BlurFade>

      {/* ═══════ STATS BENTO — hover flips to primary ═══════ */}
      <BlurFade delay={0.05}>
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10 sm:mb-12">
          <StatCell icon={Library} label="Toplam Eğitim"  value={totalCount.toString()}      hoverBg={T.primary}          hoverText={T.primaryFixed} />
          <StatCell icon={Clock}   label="Devam Eden"     value={activeCount.toString()}     hoverBg={T.tertiaryContainer} hoverText={T.primary}       />
          <StatCell icon={CheckCircle2} label="Tamamlanan" value={completedCount.toString()} hoverBg={T.secondary}        hoverText={T.secondaryFixed} isGreen />
          <StatCell icon={Activity} label="Ortalama Puan" value={averageScore}               hoverBg={T.primaryContainer}  hoverText={T.primaryFixed} />
        </section>
      </BlurFade>

      {/* ═══════ TAB SWITCHER ═══════ */}
      <BlurFade delay={0.07}>
        <div
          className="flex gap-1 p-1.5 rounded-full mb-8 sm:mb-10 w-fit"
          style={{
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: `1px solid ${T.secondary}18`,
            boxShadow: '0 2px 12px rgba(2,36,31,0.04)',
          }}
        >
          {([
            { id: 'trainings' as const, label: 'Eğitimler', count: trainingCount, Icon: BookOpen },
            { id: 'exams' as const,     label: 'Sınavlar',  count: examCount,     Icon: ClipboardCheck },
          ]).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className="flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-all duration-300"
                style={{
                  background: isActive ? T.primary : 'transparent',
                  color:      isActive ? '#ffffff' : T.onSurfaceVariant,
                }}
              >
                <tab.Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.14)' : T.surfaceHigh,
                    color:      isActive ? '#ffffff' : T.onSurfaceVariant,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* ═══════ COMPLETED SHORTCUT PILL ═══════ */}
      {completedTrainings.length > 0 && (
        <BlurFade delay={0.09}>
          <button
            onClick={scrollToCompleted}
            aria-label="Tamamlanan eğitimlere git"
            className="w-full flex items-center justify-between rounded-full px-7 py-4 mb-12 transition-all duration-300 group hover:-translate-y-0.5"
            style={{
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: `1px solid ${T.secondary}18`,
              boxShadow: '0 2px 14px rgba(86,100,43,0.05)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full" style={{ background: T.secondary }} />
              <span className="text-[13px] font-bold" style={{ color: T.secondary }}>
                Tamamlanan Eğitimler
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ background: T.secondary }}
              >
                {completedTrainings.length}
              </span>
            </div>
            <ChevronRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              style={{ color: T.secondary }}
            />
          </button>
        </BlurFade>
      )}

      {/* ═══════ ACTIVE — hero split cards ═══════ */}
      {activeTrainings.length > 0 && (
        <section className="mb-16">
          <SectionHead
            title="Aktif Eğitimler"
            count={activeTrainings.length}
            badgeBg={T.primary}
            accent={T.primary}
            delay={0.1}
          />
          <div className="space-y-6">
            {activeTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.12 + i * 0.04}>
                <ActiveHeroCard training={t} />
              </BlurFade>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ COMPLETED — bento grid ═══════ */}
      {completedTrainings.length > 0 && (
        <section ref={completedRef} className="mb-16">
          <SectionHead
            title="Tamamlanan Eğitimler"
            count={completedTrainings.length}
            badgeBg={T.secondary}
            accent={T.primary}
            delay={0.14}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {completedTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.16 + i * 0.03}>
                <CompletedCard training={t} />
              </BlurFade>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ FAILED — left-border archive ═══════ */}
      {exhaustedTrainings.length > 0 && (
        <section className="mb-10">
          <SectionHead
            title="Başarısız Eğitimler"
            count={exhaustedTrainings.length}
            badgeBg={T.error}
            accent={T.primary}
            delay={0.18}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exhaustedTrainings.map((t, i) => (
              <BlurFade key={t.id} delay={0.20 + i * 0.03}>
                <FailedCard training={t} />
              </BlurFade>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ EMPTY ═══════ */}
      {trainingList.length === 0 && (
        <BlurFade delay={0.12}>
          <div
            className="text-center py-24 rounded-2xl"
            style={{ background: T.surfaceLow, border: `1px solid ${T.outlineVariant}40` }}
          >
            <div
              className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
              style={{ background: T.surfaceHigh }}
            >
              <BookOpen className="h-6 w-6" style={{ color: T.onSurfaceVariant }} />
            </div>
            <p className="text-[17px] font-black mb-1.5" style={{ color: T.primary }}>
              Henüz eğitim atanmadı
            </p>
            <p className="text-[13px] max-w-sm mx-auto" style={{ color: T.onSurfaceVariant }}>
              Yöneticiniz size bir eğitim atadığında burada görünecek.
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

function StatCell({
  icon: Icon, label, value, hoverBg, hoverText, isGreen = false,
}: {
  icon: LucideIcon; label: string; value: string;
  hoverBg: string; hoverText: string; isGreen?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const baseBg = isGreen ? `${T.secondaryContainer}50` : T.surfaceLow;
  const baseIcon = isGreen ? T.secondary : T.primary;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-6 sm:p-7 rounded-2xl flex flex-col justify-between transition-all duration-500 cursor-default"
      style={{
        background: hover ? hoverBg : baseBg,
        minHeight: 180,
      }}
    >
      <Icon
        className="h-9 w-9 mb-6 transition-colors duration-500"
        style={{ color: hover ? hoverText : baseIcon }}
        strokeWidth={1.5}
      />
      <div>
        <div
          className="text-[32px] sm:text-[40px] font-black leading-none tracking-tight mb-1.5 transition-colors duration-500"
          style={{ color: hover ? '#ffffff' : T.primary }}
        >
          {value}
        </div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.12em] transition-colors duration-500"
          style={{ color: hover ? hoverText : T.onSurfaceVariant }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  title, count, badgeBg, accent, delay = 0,
}: { title: string; count: number; badgeBg: string; accent: string; delay?: number }) {
  return (
    <BlurFade delay={delay}>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-[22px] sm:text-[26px] font-black tracking-tight" style={{ color: accent }}>
          {title}
        </h2>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold text-white"
          style={{ background: badgeBg }}
        >
          {count}
        </span>
      </div>
    </BlurFade>
  );
}

function ActiveHeroCard({ training: t }: { training: Training }) {
  const Icon = categoryIcon(t.category);
  const isUrgent = t.daysLeft !== undefined && t.daysLeft <= 3;
  const status = (statusLabel[t.status as StatusKey] ?? t.status);

  return (
    <Link href={`/staff/my-trainings/${t.id}`} className="block group">
      <article
        className="rounded-2xl overflow-hidden flex flex-col md:flex-row transition-[transform,box-shadow] duration-500 group-hover:-translate-y-1"
        style={{
          background: T.surfaceLowest,
          boxShadow: '0 20px 40px -20px rgba(2, 36, 31, 0.12), 0 4px 12px rgba(2, 36, 31, 0.04)',
        }}
      >
        {/* Left: gradient panel with icon */}
        <div
          className="md:w-[34%] h-52 md:h-auto relative overflow-hidden shrink-0"
          style={{
            background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryContainer} 55%, ${T.primaryDeep} 110%)`,
          }}
        >
          {/* Decorative rings */}
          <div
            aria-hidden
            className="absolute -right-16 -top-16 w-64 h-64 rounded-full"
            style={{ background: `radial-gradient(circle at center, ${T.primaryFixedDim}25 0%, transparent 60%)` }}
          />
          <div
            aria-hidden
            className="absolute -left-20 -bottom-20 w-48 h-48 rounded-full"
            style={{ background: `radial-gradient(circle at center, ${T.tertiaryContainer}20 0%, transparent 60%)` }}
          />

          {/* Big icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="p-5 rounded-3xl transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Icon className="h-14 w-14" style={{ color: T.primaryFixed }} strokeWidth={1.5} />
            </div>
          </div>

          {/* Category tag */}
          <div className="absolute top-5 left-5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: T.primaryFixed,
                backdropFilter: 'blur(12px)',
              }}
            >
              {t.category || 'Genel'}
            </span>
          </div>

          {/* Urgency badge */}
          {isUrgent && (
            <div className="absolute bottom-5 left-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ background: T.tertiaryContainer, color: T.primary }}
              >
                <Sparkles className="h-3 w-3" />
                Son {t.daysLeft} Gün
              </span>
            </div>
          )}
        </div>

        {/* Right: content */}
        <div className="p-7 md:p-10 flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ background: T.secondaryContainer, color: T.onSecondaryContainer }}
              >
                {status}
              </span>
              <span className="text-[11px] font-mono" style={{ color: T.onSurfaceVariant }}>
                Bitiş: <strong style={{ color: isUrgent ? T.error : T.onSurface }}>{t.deadline}</strong>
              </span>
              {t.examOnly && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                  style={{ background: `${T.tertiaryContainer}30`, color: T.tertiary }}
                >
                  Sadece Sınav
                </span>
              )}
            </div>

            <h3
              className="text-[22px] sm:text-[28px] font-black leading-[1.1] tracking-tight mb-4"
              style={{ color: T.primary }}
            >
              {t.title}
            </h3>

            {/* Inline stats ruler */}
            <dl
              className="grid grid-cols-3 gap-4 py-4 border-y mb-6"
              style={{ borderColor: `${T.outlineVariant}60` }}
            >
              <MiniStat label="Deneme"   value={`${t.attempt ?? 0} / ${t.maxAttempts ?? 3}`} />
              <MiniStat label="İlerleme" value={`%${t.progress ?? 0}`} accent={T.secondary} />
              {t.examOnly ? (
                <MiniStat label="Süre" value={`${t.examDurationMinutes ?? '—'} dk`} />
              ) : t.daysLeft !== undefined ? (
                <MiniStat label="Kalan" value={`${t.daysLeft} gün`} accent={isUrgent ? T.error : undefined} />
              ) : (
                <MiniStat label="Soru" value={`${t.questionCount ?? '—'}`} />
              )}
            </dl>
          </div>

          {/* CTA row */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px]" style={{ color: T.onSurfaceVariant }}>
              {t.status === 'assigned' ? 'Eğitime başlamak için hazırsınız' : 'Kaldığınız yerden devam edin'}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full pl-6 pr-5 py-3 text-[13px] font-extrabold transition-all duration-300 group-hover:pr-6"
              style={{
                background: T.primary,
                color: '#ffffff',
                boxShadow: `0 4px 14px ${T.primary}33`,
              }}
            >
              <Play className="h-[13px] w-[13px]" fill="currentColor" />
              {t.status === 'assigned' ? 'Başla' : 'Devam Et'}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <dt
        className="text-[9px] font-bold uppercase tracking-[0.16em] mb-1"
        style={{ color: T.onSurfaceVariant }}
      >
        {label}
      </dt>
      <dd
        className="text-[15px] font-extrabold font-mono"
        style={{ color: accent ?? T.primary }}
      >
        {value}
      </dd>
    </div>
  );
}

function CompletedCard({ training: t }: { training: Training }) {
  const Icon = categoryIcon(t.category);
  const scoreColor =
    (t.score ?? 0) >= 80 ? T.secondary :
    (t.score ?? 0) >= 60 ? T.tertiary :
    T.error;
  const isLocked = t.status === 'locked';
  const isTopScore = !isLocked && (t.score ?? 0) >= 95;

  return (
    <Link href={`/staff/my-trainings/${t.id}`} className="block group">
      <article
        className="rounded-2xl p-7 transition-all duration-500 group-hover:-translate-y-2 relative"
        style={{
          background: T.surfaceLowest,
          boxShadow: isTopScore
            ? `0 12px 30px -12px ${T.secondary}40, 0 2px 8px rgba(0,0,0,0.04)`
            : '0 8px 24px -12px rgba(2,36,31,0.12), 0 2px 6px rgba(0,0,0,0.03)',
          opacity: isLocked ? 0.6 : 1,
        }}
      >
        <div className="flex justify-between items-start mb-7">
          <div
            className="p-3 rounded-2xl"
            style={{ background: `${T.secondary}10` }}
          >
            <Icon className="h-6 w-6" style={{ color: T.secondary }} strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2">
            {isTopScore && (
              <Award
                className="h-5 w-5 shrink-0"
                style={{ color: T.tertiary }}
                strokeWidth={2}
                aria-label="Yüksek skor"
              />
            )}
            <span
              className="text-[22px] font-black leading-none"
              style={{ color: scoreColor }}
            >
              %{t.score ?? 0}
            </span>
          </div>
        </div>

        <h4
          className="text-[16px] sm:text-[17px] font-black leading-[1.2] tracking-tight mb-2 min-h-[2.5rem]"
          style={{ color: T.primary }}
        >
          {t.title}
        </h4>

        <div className="flex items-center gap-2 text-[11px] font-mono mb-6" style={{ color: T.onSurfaceVariant }}>
          <span>{t.category || 'Genel'}</span>
          <span aria-hidden>·</span>
          <span>{t.deadline}</span>
          {isLocked && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: T.error }}>
                <Lock className="h-3 w-3" />
                Kilitli
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-[3px] rounded-full overflow-hidden mb-6"
          style={{ background: T.surfaceHigh }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${t.score ?? 0}%`,
              background: scoreColor,
            }}
          />
        </div>

        <div
          className="w-full text-center text-[13px] font-bold py-2.5 rounded-full transition-all duration-300 flex items-center justify-center gap-2 group-hover:gap-3"
          style={{
            border: `1px solid ${T.outlineVariant}50`,
            color: T.primary,
          }}
        >
          Detayı Görüntüle
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </article>
    </Link>
  );
}

function FailedCard({ training: t }: { training: Training }) {
  return (
    <Link href={`/staff/my-trainings/${t.id}`} className="block group">
      <article
        className="rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-0.5"
        style={{
          background: T.surfaceLowest,
          borderLeft: `4px solid ${T.error}`,
          boxShadow: `0 6px 20px -12px ${T.error}30, 0 2px 4px rgba(0,0,0,0.03)`,
        }}
      >
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
            style={{ background: `${T.error}12` }}
          >
            <AlertOctagon className="h-5 w-5" style={{ color: T.error }} />
          </div>
          <div className="min-w-0">
            <h4
              className="text-[15px] font-black truncate mb-0.5"
              style={{ color: T.primary }}
            >
              {t.title}
            </h4>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: T.error }}
            >
              Haklar Tükendi
            </span>
          </div>
          <div className="ml-auto shrink-0 text-right hidden sm:block">
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.onSurfaceVariant }}>
              Son Skor
            </div>
            <div className="text-[18px] font-black font-mono leading-none mt-0.5" style={{ color: T.error }}>
              %{t.score ?? 0}
            </div>
          </div>
        </div>

        <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: T.onSurfaceVariant }}>
          Bu eğitim için tanımlanan {t.maxAttempts} deneme hakkının tamamı kullanılmıştır. Ek deneme hakkı için akademik birim yöneticinize başvurunuz.
        </p>

        <div className="flex items-center justify-between text-[11px] font-mono pt-3 border-t" style={{ borderColor: `${T.outlineVariant}40`, color: T.onSurfaceVariant }}>
          <span>Son tarih: {t.deadline}</span>
          <span className="inline-flex items-center gap-1 font-bold transition-transform duration-300 group-hover:translate-x-0.5" style={{ color: T.error }}>
            Yöneticiye Başvur
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}
