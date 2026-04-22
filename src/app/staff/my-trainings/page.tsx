'use client';

/**
 * Eğitimlerim — "Clinical Editorial" redesign.
 * Notifications + Calendar + SMG + Profile + Dashboard ile aynı dil:
 * cream + ink (navy) + gold + serif display + mono caps + radial dot bg.
 * Filtreleme/segmentasyon mantığı PR #21'den korundu, görsel dil hizalandı.
 */

import { useState, useMemo, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  BookOpen, Clock, CheckCircle2, Lock, Play, ArrowRight, ClipboardCheck,
  AlertOctagon, Stethoscope, HeartPulse, Activity, ShieldCheck, Microscope,
  FlaskConical, Syringe, Scale, Award, BookOpenText, TrendingUp,
  Flame, Hash,
} from 'lucide-react';
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

/* ─── Editorial palette ─── */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

/* ─── Domain mappings ─── */

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
const STATUS: Record<StatusKey, { label: string; ink: string; bg: string; dot: string }> = {
  assigned:    { label: 'ATANDI',  ink: '#1f3a7a', bg: '#eef2fb', dot: '#2c55b8' },
  in_progress: { label: 'DEVAM',   ink: '#6a4e11', bg: '#fef6e7', dot: '#b4820b' },
  passed:      { label: 'GEÇTİ',   ink: '#0a7a47', bg: '#eaf6ef', dot: '#0a7a47' },
  failed:      { label: 'KALDI',   ink: '#b3261e', bg: '#fdf5f2', dot: '#b3261e' },
  locked:      { label: 'KİLİTLİ', ink: '#8a5a11', bg: '#f4efdf', dot: '#b4820b' },
};

const monthShort = ['', 'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];

function splitDate(deadline?: string): { day: string; month: string } {
  if (!deadline) return { day: '—', month: '---' };
  const parts = deadline.split('.');
  const day = parts[0] ?? '—';
  const mIdx = parseInt(parts[1] ?? '0', 10);
  return { day, month: monthShort[mIdx] ?? '---' };
}

/* ─── Page ─── */

export default function MyTrainingsPage() {
  const { data: rawData, isLoading, error } =
    useFetch<{ data: Training[] } | Training[]>('/api/staff/my-trainings');
  const [activeTab, setActiveTab] = useState<'trainings' | 'exams'>('trainings');

  /* Cream theme cascade */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main as HTMLElement;
    const prevBg = el.style.backgroundColor;
    const prevVar = el.style.getPropertyValue('--color-bg-rgb');
    el.style.backgroundColor = CREAM;
    el.style.setProperty('--color-bg-rgb', '250, 247, 242');
    return () => {
      el.style.backgroundColor = prevBg;
      if (prevVar) el.style.setProperty('--color-bg-rgb', prevVar);
      else el.style.removeProperty('--color-bg-rgb');
    };
  }, []);

  const allItems: Training[] = useMemo(
    () => (Array.isArray(rawData) ? rawData : (rawData as { data: Training[] })?.data ?? []),
    [rawData],
  );

  const segmented = useMemo(() => {
    const list = allItems.filter(t => (activeTab === 'exams' ? t.examOnly : !t.examOnly));
    const isExhaustedFailed = (t: Training) => t.status === 'failed' && t.attempt >= t.maxAttempts;
    const active = list.filter(
      t => (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'failed') && !isExhaustedFailed(t),
    );
    const exhausted = list.filter(isExhaustedFailed);
    const completed = list.filter(t => t.status === 'passed');
    const lockedList = list.filter(t => t.status === 'locked');
    const passed = completed.length;
    const scores = list.filter(t => t.score).map(t => t.score!);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const urgent = active.filter(t => t.daysLeft !== undefined && t.daysLeft <= 3).length;

    return {
      list,
      examCount: allItems.filter(t => t.examOnly).length,
      trainingCount: allItems.filter(t => !t.examOnly).length,
      active, exhausted, completed, locked: lockedList,
      total: list.length,
      activeCount: active.length,
      completedCount: passed,
      averageScore: avg,
      urgentCount: urgent,
    };
  }, [allItems, activeTab]);

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(10, 22, 40, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
        <MandatoryFeedbackBanner />

        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b pb-5"
          style={{ borderColor: INK }}
        >
          <div className="flex items-end gap-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              № 02 · Eğitimler
            </p>
            <h1
              className="text-[36px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              eğitim portalı<span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          {segmented.urgentCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: '#b3261e',
                backgroundColor: '#fdf5f2',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <Flame className="h-3 w-3" />
              {segmented.urgentCount} acil görev
            </span>
          )}
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Atanan eğitimleri tamamla · sınavlardan geç · sertifikalarını topla
        </p>

        {error ? (
          <div
            className="mt-10 grid items-center gap-4 p-4"
            style={{
              gridTemplateColumns: '4px 36px 1fr',
              backgroundColor: '#fdf5f2',
              border: `1px solid #e9c9c0`,
              borderRadius: '4px',
            }}
          >
            <span style={{ backgroundColor: '#b3261e', alignSelf: 'stretch', borderRadius: '2px' }} />
            <div
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, backgroundColor: '#b3261e', borderRadius: '2px' }}
            >
              <AlertOctagon className="h-4 w-4" style={{ color: CREAM }} />
            </div>
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Hata
              </p>
              <p className="mt-1 text-[14px]" style={{ color: '#7a1d14' }}>{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <TrainingsSkeleton />
        ) : (
          <>
            {/* ───── KPI strip ───── */}
            <section className="mt-8">
              <div
                className="grid"
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${RULE}`,
                  borderRadius: '4px',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                }}
              >
                <KpiTile icon={BookOpen}    label="Toplam"     value={segmented.total}          tone={INK}       num="01" />
                <KpiTile icon={Clock}       label="Devam Eden" value={segmented.activeCount}    tone="#b4820b" num="02" />
                <KpiTile icon={CheckCircle2} label="Tamamlanan" value={segmented.completedCount} tone="#0a7a47" num="03" />
                <KpiTile
                  icon={TrendingUp}
                  label="Ortalama"
                  value={segmented.averageScore ?? '—'}
                  suffix={segmented.averageScore !== null ? '%' : undefined}
                  tone={GOLD}
                  num="04"
                  last
                />
              </div>
            </section>

            {/* ───── Tab switcher ───── */}
            <div className="mt-6 flex">
              <div
                className="inline-flex"
                style={{ border: `1px solid ${INK}`, borderRadius: '2px' }}
                role="tablist"
                aria-label="Eğitim tipi filtresi"
              >
                {([
                  { id: 'trainings' as const, label: 'EĞİTİMLER', count: segmented.trainingCount, Icon: BookOpen },
                  { id: 'exams' as const,     label: 'SINAVLAR',  count: segmented.examCount,     Icon: ClipboardCheck },
                ]).map((tab, i) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold tracking-[0.14em]"
                      style={{
                        color: isActive ? CREAM : INK,
                        backgroundColor: isActive ? INK : 'transparent',
                        borderLeft: i > 0 ? `1px solid ${INK}` : 'none',
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      }}
                    >
                      <tab.Icon className="h-3.5 w-3.5" style={{ color: isActive ? GOLD : INK_SOFT }} />
                      {tab.label}
                      <span
                        className="ml-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
                        style={{
                          color: isActive ? CREAM : INK_SOFT,
                          backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ───── Sections ───── */}
            <div className="mt-10 space-y-12">
              {segmented.active.length > 0 && (
                <RowSection number="I." title="Aktif görevler" subtitle="Devam eden veya başlanmamış" count={segmented.active.length}>
                  <ul className="space-y-2.5">
                    {segmented.active.map((t, i) => (
                      <ActiveRow key={t.id} t={t} index={i + 1} />
                    ))}
                  </ul>
                </RowSection>
              )}

              {segmented.completed.length > 0 && (
                <RowSection number="II." title="Tamamlanan" subtitle="Geçtiğin sınavlar + skorların" count={segmented.completed.length} accent={OLIVE}>
                  <ul className="space-y-2.5">
                    {segmented.completed.map((t, i) => (
                      <CompletedRow key={t.id} t={t} index={i + 1} />
                    ))}
                  </ul>
                </RowSection>
              )}

              {segmented.exhausted.length > 0 && (
                <RowSection number="III." title="Haklar tükendi" subtitle="Tüm deneme hakların kullanıldı" count={segmented.exhausted.length} accent="#b3261e">
                  <ul className="space-y-2.5">
                    {segmented.exhausted.map((t, i) => (
                      <ArchiveRow key={t.id} t={t} variant="failed" index={i + 1} />
                    ))}
                  </ul>
                </RowSection>
              )}

              {segmented.locked.length > 0 && (
                <RowSection number="IV." title="Kilitli" subtitle="Yönetici tarafından kilitlenmiş" count={segmented.locked.length} accent="#b4820b">
                  <ul className="space-y-2.5">
                    {segmented.locked.map((t, i) => (
                      <ArchiveRow key={t.id} t={t} variant="locked" index={i + 1} />
                    ))}
                  </ul>
                </RowSection>
              )}

              {segmented.list.length === 0 && (
                <EmptyBlock
                  icon={BookOpen}
                  title={`Henüz ${activeTab === 'exams' ? 'sınav' : 'eğitim'} atanmadı`}
                  description={`Yöneticin sana ${activeTab === 'exams' ? 'bir sınav' : 'bir eğitim'} atadığında burada görünecek.`}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function KpiTile({
  icon: Icon, label, value, suffix, tone, num, last,
}: {
  icon: typeof BookOpen; label: string; value: number | string;
  suffix?: string; tone: string; num: string; last?: boolean;
}) {
  return (
    <div
      className="relative px-5 py-5"
      style={{ borderRight: last ? 'none' : `1px solid ${RULE}` }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: '3px', backgroundColor: tone }}
      />
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {label}
        </span>
        <span
          className="ml-auto text-[9px] tabular-nums"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {num}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[36px] font-semibold tabular-nums leading-none tracking-[-0.025em]"
          style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
        >
          {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
        </span>
        {suffix && (
          <span
            className="text-[12px] font-semibold"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function RowSection({
  number, title, subtitle, count, accent, children,
}: {
  number: string; title: string; subtitle: string; count: number;
  accent?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <header
        className="grid items-end gap-4 pb-3 border-b"
        style={{ gridTemplateColumns: '40px 1fr max-content', borderColor: RULE }}
      >
        <span
          className="text-[11px] font-semibold tracking-[0.2em]"
          style={{ color: accent ?? GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {number}
        </span>
        <div>
          <h2
            className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {title}
          </h2>
          <p
            className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {subtitle}
          </p>
        </div>
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          [{count.toString().padStart(2, '0')}]
        </span>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ActiveRow({ t, index }: { t: Training; index: number }) {
  const Icon = categoryIcon(t.category);
  const isUrgent = t.daysLeft !== undefined && t.daysLeft <= 3;
  const isStarted = t.status === 'in_progress' || t.progress > 0;
  const isFailedRetry = t.status === 'failed';
  const status = STATUS[t.status as StatusKey] ?? STATUS.assigned;
  const railColor = isFailedRetry ? '#b4820b' : isUrgent ? '#b3261e' : status.dot;
  const { day, month } = splitDate(t.deadline);

  return (
    <li>
      <Link
        href={`/staff/my-trainings/${t.id}`}
        className="group grid items-stretch overflow-hidden focus:outline-none grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[40px_56px_minmax(0,1fr)_max-content]"
        style={{
          backgroundColor: '#ffffff',
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '4px',
          borderTopColor: RULE,
          borderRightColor: RULE,
          borderBottomColor: RULE,
          borderLeftColor: railColor,
          borderStyle: 'solid',
          borderRadius: '4px',
          transition: 'box-shadow 160ms ease, transform 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 0 0 ' + INK; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Index — hidden on mobile to give body more room */}
        <div className="hidden sm:flex items-center justify-center border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {index.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Date */}
        <div className="flex flex-col items-center justify-center py-3 border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: isUrgent ? '#b3261e' : INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {month}
          </span>
          <span
            className="text-[20px] font-semibold tabular-nums leading-none tracking-[-0.02em] mt-0.5"
            style={{
              color: isUrgent ? '#b3261e' : INK,
              fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
            }}
          >
            {day}
          </span>
        </div>

        {/* Body */}
        <div className="min-w-0 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: status.ink,
                backgroundColor: status.bg,
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
              {status.label}
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              {t.category || 'GENEL'}
            </span>
            {isUrgent && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                <Flame className="h-2.5 w-2.5" />
                Son {t.daysLeft}g
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 26, height: 26, backgroundColor: CREAM, borderRadius: '2px' }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: railColor }} />
            </span>
            <h3
              className="truncate text-[15px] font-semibold tracking-[-0.01em]"
              style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {t.title}
            </h3>
          </div>

          {isStarted && (
            <div className="mt-2 flex items-center gap-3">
              <div
                className="relative h-[3px] flex-1 max-w-[260px] overflow-hidden"
                style={{ backgroundColor: RULE, borderRadius: '1px' }}
              >
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${t.progress}%`,
                    backgroundColor: OLIVE,
                    transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
              <span
                className="text-[10px] tabular-nums font-semibold"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                {t.progress}%
              </span>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetaPair icon={Hash} label="Hak" value={`${Math.max(t.attempt, 1)}/${t.maxAttempts}`} />
            {t.examOnly && t.examDurationMinutes != null && (
              <MetaPair icon={Clock} label="Süre" value={`${t.examDurationMinutes}dk`} />
            )}
            {t.examOnly && t.questionCount != null && (
              <MetaPair icon={ClipboardCheck} label="Soru" value={`${t.questionCount}`} />
            )}
          </div>
        </div>

        {/* CTA — hidden on mobile (tap the whole card navigates); visible from sm: */}
        <div className="hidden sm:flex items-center border-l px-5" style={{ borderColor: RULE }}>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: INK, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            <Play className="h-3 w-3" fill="currentColor" />
            {isStarted || isFailedRetry ? 'Devam' : 'Başla'}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              style={{ color: GOLD }}
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

function CompletedRow({ t, index }: { t: Training; index: number }) {
  const Icon = categoryIcon(t.category);
  const score = t.score ?? 0;
  const isTop = score >= 95;
  const tier = score >= 95 ? 'MÜKEMMEL' : score >= 85 ? 'YÜKSEK' : score >= 70 ? 'İYİ' : score >= 60 ? 'ORTA' : 'DÜŞÜK';

  return (
    <li>
      <Link
        href={`/staff/my-trainings/${t.id}`}
        className="grid items-center overflow-hidden focus:outline-none grid-cols-[minmax(0,1fr)_max-content] sm:grid-cols-[40px_minmax(0,1fr)_max-content_max-content]"
        style={{
          backgroundColor: '#ffffff',
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '4px',
          borderTopColor: RULE,
          borderRightColor: RULE,
          borderBottomColor: RULE,
          borderLeftColor: OLIVE,
          borderStyle: 'solid',
          borderRadius: '4px',
        }}
      >
        <div className="hidden sm:flex items-center justify-center py-4 border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {index.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="min-w-0 px-4 py-3 flex items-center gap-3">
          <span
            className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, backgroundColor: '#eaf6ef', borderRadius: '2px' }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: '#0a7a47' }} />
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-[14px] font-semibold tracking-[-0.01em]"
              style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {t.title}
            </p>
            <p
              className="mt-0.5 text-[10px] uppercase tracking-[0.12em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              {t.category || 'GENEL'}{t.deadline && ` · ${t.deadline}`}
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-l" style={{ borderColor: RULE }}>
          <div className="flex items-baseline gap-1 justify-end">
            {isTop && <Award className="h-3.5 w-3.5 self-center" style={{ color: GOLD }} />}
            <span
              className="text-[24px] font-semibold tabular-nums leading-none tracking-[-0.025em]"
              style={{ color: '#0a7a47', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {score}
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              %
            </span>
          </div>
          <p
            className="text-right text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: '#0a7a47', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {tier}
          </p>
        </div>

        <div className="hidden sm:flex items-center px-4 border-l" style={{ borderColor: RULE }}>
          <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
        </div>
      </Link>
    </li>
  );
}

function ArchiveRow({
  t, variant, index,
}: { t: Training; variant: 'failed' | 'locked'; index: number }) {
  const Icon = categoryIcon(t.category);
  const isLocked = variant === 'locked';
  const accent = isLocked ? '#b4820b' : '#b3261e';
  const accentBg = isLocked ? '#fef6e7' : '#fdf5f2';
  const StateIcon = isLocked ? Lock : AlertOctagon;
  const stateLabel = isLocked ? 'KİLİTLİ' : 'HAKLAR TÜKENDİ';
  const description = isLocked
    ? 'Yönetici tarafından kilitlenmiştir. Akademik birime başvur.'
    : `${t.maxAttempts} deneme hakkın kullanıldı. Ek hak için yöneticine başvur.`;

  return (
    <li>
      <Link
        href={`/staff/my-trainings/${t.id}`}
        className="grid items-stretch overflow-hidden focus:outline-none"
        style={{
          gridTemplateColumns: '40px 1fr max-content',
          backgroundColor: '#ffffff',
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '4px',
          borderTopColor: RULE,
          borderRightColor: RULE,
          borderBottomColor: RULE,
          borderLeftColor: accent,
          borderStyle: 'solid',
          borderRadius: '4px',
        }}
      >
        <div className="flex items-center justify-center py-4 border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {index.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="min-w-0 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: accent,
                backgroundColor: accentBg,
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              <StateIcon className="h-3 w-3" />
              {stateLabel}
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              {t.category || 'GENEL'}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 26, height: 26, backgroundColor: CREAM, borderRadius: '2px' }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            </span>
            <h3
              className="truncate text-[15px] font-semibold tracking-[-0.01em]"
              style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {t.title}
            </h3>
          </div>

          <p className="mt-2 text-[12px]" style={{ color: INK_SOFT }}>
            {description}
          </p>

          {!isLocked && t.deadline && (
            <p
              className="mt-1 text-[10px] uppercase tracking-[0.12em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              SON TARİH · {t.deadline}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end justify-center px-4 py-3 border-l" style={{ borderColor: RULE }}>
          {!isLocked && t.score !== undefined && (
            <>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[20px] font-semibold tabular-nums leading-none tracking-[-0.025em]"
                  style={{ color: accent, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                >
                  {t.score ?? 0}
                </span>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  %
                </span>
              </div>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.14em] mt-1"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Son skor
              </span>
            </>
          )}
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] mt-2"
            style={{ color: INK, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            Detay
            <ArrowRight className="h-3 w-3" style={{ color: GOLD }} />
          </span>
        </div>
      </Link>
    </li>
  );
}

function MetaPair({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: INK_SOFT }}>
      <Icon className="h-3 w-3" />
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.14em]"
        style={{ fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {label}
      </span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {value}
      </span>
    </span>
  );
}

function EmptyBlock({
  icon: Icon, title, description,
}: { icon: typeof BookOpen; title: string; description: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-16"
      style={{
        border: `1px dashed ${RULE}`,
        borderRadius: '4px',
        backgroundColor: 'rgba(255,255,255,0.5)',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 48, height: 48,
          backgroundColor: CREAM,
          border: `1px solid ${RULE}`,
          borderRadius: '2px',
        }}
      >
        <Icon style={{ width: 22, height: 22, color: INK_SOFT }} />
      </div>
      <p
        className="mt-3 text-[16px] font-semibold tracking-[-0.01em]"
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[12px]" style={{ color: INK_SOFT }}>
        {description}
      </p>
    </div>
  );
}

function TrainingsSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
    </div>
  );
}
