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

/* Kategori → klinik ikon eşlemesi */
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

// Editorial Clinical status chips
const statusChip: Record<StatusKey, { bg: string; text: string; dot: string }> = {
  assigned:    { bg: '#eef2fb', text: '#1f3a7a', dot: '#2c55b8' },
  in_progress: { bg: '#fef6e7', text: '#6a4e11', dot: '#b4820b' },
  passed:      { bg: '#eaf6ef', text: '#0a7a47', dot: '#0a7a47' },
  failed:      { bg: '#fdf5f2', text: '#b3261e', dot: '#b3261e' },
  locked:      { bg: '#f4efdf', text: '#8a5a11', dot: '#b4820b' },
};

const monthShort = ['', 'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];

function splitDate(deadline?: string): { day: string; month: string } {
  if (!deadline) return { day: '—', month: '---' };
  const parts = deadline.split('.');
  const day = parts[0] ?? '—';
  const mIdx = parseInt(parts[1] ?? '0', 10);
  return { day, month: monthShort[mIdx] ?? '---' };
}

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
    const isExhaustedFailed = (t: Training) => t.status === 'failed' && t.attempt >= t.maxAttempts;
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
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
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
      <div className="mt-empty">
        <div className="mt-empty-icon"><AlertOctagon className="h-6 w-6" /></div>
        <h2>Eğitimler yüklenemedi</h2>
        <p>{error}</p>
        <style>{`
          .mt-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px; gap: 10px; }
          .mt-empty-icon { width: 56px; height: 56px; border-radius: 999px; background: #fdf5f2; color: #b3261e; display: flex; align-items: center; justify-content: center; }
          h2 { font-family: var(--font-editorial, serif); font-size: 20px; color: #b3261e; margin: 0; }
          p { font-size: 13px; color: #6b6a63; margin: 0; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mt-page">
      <MandatoryFeedbackBanner />

      {/* ═══════ Editorial Header ═══════ */}
      <header className="mt-header">
        <div className="mt-header-meta">
          <span className="mt-eyebrow">
            <span className="mt-eyebrow-dot" />
            Eğitim Portalı
          </span>
          {urgentCount > 0 && (
            <span className="mt-urgent-pill">
              <Flame className="h-3 w-3" />
              {urgentCount} acil
            </span>
          )}
        </div>
        <h1 className="mt-title">
          <em>Eğitimlerim</em>
        </h1>
        <p className="mt-subtitle">Atanan eğitimleri tamamla, sınavlardan geç, sertifikalarını topla.</p>
      </header>

      {/* ═══════ KPI strip ═══════ */}
      <section className="mt-kpis" aria-label="Eğitim özeti">
        <KpiTile label="Toplam" value={totalCount} tone="ink" icon={<BookOpen className="h-4 w-4" />} />
        <KpiTile label="Devam Eden" value={activeCount} tone="amber" icon={<Clock className="h-4 w-4" />} />
        <KpiTile label="Tamamlanan" value={completedCount} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiTile
          label="Ortalama"
          value={averageScore ?? '—'}
          suffix={averageScore !== null ? '%' : undefined}
          tone="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      {/* ═══════ Tab switcher ═══════ */}
      <div className="mt-tabs-wrap">
        <div role="tablist" aria-label="Eğitim tipi filtresi" className="mt-tabs">
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
                className={`mt-tab ${isActive ? 'mt-tab-on' : ''}`}
              >
                <tab.Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span className="mt-tab-count">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════ Aktif Eğitimler ═══════ */}
      {activeTrainings.length > 0 && (
        <Section title="Aktif" count={activeTrainings.length} accent="#0a0a0a">
          <div className="mt-active-list">
            {activeTrainings.map((t, i) => (
              <ActiveCard key={t.id} training={t} delay={i * 35} />
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ Tamamlanan ═══════ */}
      {completedTrainings.length > 0 && (
        <Section title="Tamamlanan" count={completedTrainings.length} accent="#0a7a47">
          <div className="mt-completed-grid">
            {completedTrainings.map((t, i) => (
              <CompletedCard key={t.id} training={t} delay={i * 30} />
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ Başarısız (hakkı tükenen) ═══════ */}
      {exhaustedTrainings.length > 0 && (
        <Section title="Haklar Tükendi" count={exhaustedTrainings.length} accent="#b3261e">
          <div className="mt-archive-grid">
            {exhaustedTrainings.map((t, i) => (
              <ArchiveCard key={t.id} training={t} variant="failed" delay={i * 30} />
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ Kilitli ═══════ */}
      {lockedTrainings.length > 0 && (
        <Section title="Kilitli" count={lockedTrainings.length} accent="#b4820b">
          <div className="mt-archive-grid">
            {lockedTrainings.map((t, i) => (
              <ArchiveCard key={t.id} training={t} variant="locked" delay={i * 30} />
            ))}
          </div>
        </Section>
      )}

      {/* ═══════ Empty ═══════ */}
      {trainingList.length === 0 && (
        <div className="mt-empty-page">
          <div className="mt-empty-page-icon"><BookOpen className="h-6 w-6" /></div>
          <h2>Henüz {activeTab === 'exams' ? 'sınav' : 'eğitim'} atanmadı</h2>
          <p>
            Yöneticiniz size {activeTab === 'exams' ? 'bir sınav' : 'bir eğitim'} atadığında
            burada görünecek.
          </p>
        </div>
      )}

      <style jsx>{`
        .mt-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-bottom: 40px;
        }

        /* ── Header ── */
        .mt-header { padding-bottom: 20px; border-bottom: 1px solid #ebe7df; }
        .mt-header-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .mt-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8a8578;
        }
        .mt-eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #0a7a47;
          display: inline-block;
          box-shadow: 0 0 0 3px rgba(10, 122, 71, 0.12);
        }
        .mt-urgent-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          background: #fef6e7;
          color: #6a4e11;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .mt-title {
          font-family: var(--font-editorial, serif);
          font-size: clamp(30px, 5vw, 48px);
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0;
        }
        .mt-title em {
          font-style: italic;
          font-variation-settings: 'opsz' 72, 'SOFT' 100;
        }
        .mt-subtitle {
          font-size: 13px;
          color: #6b6a63;
          margin: 8px 0 0;
          max-width: 520px;
          line-height: 1.55;
        }

        /* ── KPI strip ── */
        .mt-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        /* ── Tabs ── */
        .mt-tabs-wrap { display: flex; }
        .mt-tabs {
          display: inline-flex;
          padding: 4px;
          border-radius: 999px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          gap: 2px;
        }
        .mt-tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 500;
          color: #6b6a63;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 180ms ease, color 180ms ease;
        }
        .mt-tab:hover { color: #0a0a0a; }
        .mt-tab-on {
          background: #0a0a0a;
          color: #fafaf7;
          font-weight: 600;
        }
        .mt-tab-on:hover { color: #fafaf7; }
        .mt-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(10, 10, 10, 0.08);
          color: inherit;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .mt-tab-on .mt-tab-count {
          background: rgba(255, 255, 255, 0.14);
          color: #fafaf7;
        }

        /* ── Empty ── */
        .mt-empty-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 80px 20px;
          gap: 10px;
          background: #ffffff;
          border: 1px dashed #ebe7df;
          border-radius: 16px;
        }
        .mt-empty-page-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: #faf8f2;
          color: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mt-empty-page h2 {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          color: #0a0a0a;
          margin: 0;
        }
        .mt-empty-page p {
          font-size: 13px;
          color: #6b6a63;
          margin: 0;
          max-width: 320px;
        }

        .mt-active-list { display: flex; flex-direction: column; gap: 10px; }
        .mt-completed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .mt-archive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }

        @media (max-width: 700px) {
          .mt-kpis { grid-template-columns: repeat(2, 1fr); }
          .mt-tabs { width: 100%; }
          .mt-tab { flex: 1; justify-content: center; padding: 0 12px; }
        }

        @media (max-width: 420px) {
          .mt-kpis { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ── KPI Tile ──
function KpiTile({ label, value, suffix, tone, icon }: {
  label: string;
  value: number | string;
  suffix?: string;
  tone: 'ink' | 'ok' | 'amber' | 'emerald';
  icon: React.ReactNode;
}) {
  const accent = { ink: '#0a0a0a', ok: '#0a7a47', amber: '#b4820b', emerald: '#0a7a47' }[tone];
  return (
    <div className="k-tile">
      <div className="k-rail" />
      <div className="k-head">
        <span className="k-icon">{icon}</span>
        <span className="k-label">{label}</span>
      </div>
      <div className="k-value">
        <span className="k-number">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</span>
        {suffix && <span className="k-suffix">{suffix}</span>}
      </div>
      <style jsx>{`
        .k-tile {
          position: relative;
          padding: 16px 18px 16px 22px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #ebe7df;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .k-rail {
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 3px;
          background: ${accent};
          border-radius: 0 2px 2px 0;
        }
        .k-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .k-icon { display: inline-flex; color: ${accent}; opacity: 0.7; }
        .k-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b6a63;
        }
        .k-value { display: flex; align-items: baseline; gap: 3px; }
        .k-number {
          font-family: var(--font-editorial, serif);
          font-size: 28px;
          font-weight: 500;
          font-variation-settings: 'opsz' 48, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .k-suffix {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          color: #8a8578;
        }
      `}</style>
    </div>
  );
}

// ── Section wrapper ──
function Section({ title, count, accent, children }: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="s-root">
      <div className="s-head">
        <span className="s-rail" style={{ background: accent }} />
        <h2 className="s-title">{title}</h2>
        <span className="s-count">{count.toString().padStart(2, '0')}</span>
      </div>
      {children}
      <style jsx>{`
        .s-root { display: flex; flex-direction: column; gap: 12px; }
        .s-head { display: flex; align-items: center; gap: 10px; }
        .s-rail { width: 3px; height: 18px; border-radius: 2px; }
        .s-title {
          font-family: var(--font-editorial, serif);
          font-size: 18px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .s-count {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </section>
  );
}

// ── Active Card ──
function ActiveCard({ training: t, delay = 0 }: { training: Training; delay?: number }) {
  const Icon = categoryIcon(t.category);
  const isUrgent = t.daysLeft !== undefined && t.daysLeft <= 3;
  const isStarted = t.status === 'in_progress' || t.progress > 0;
  const isFailedRetry = t.status === 'failed';
  const accent = isFailedRetry ? '#b4820b' : isUrgent ? '#b3261e' : isStarted ? '#2c55b8' : '#0a0a0a';
  const status = statusLabel[t.status as StatusKey] ?? t.status;
  const chip = statusChip[t.status as StatusKey] ?? statusChip.assigned;
  const { day, month } = splitDate(t.deadline);

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="ac-link"
      aria-label={`${t.title} · ${status}${isUrgent ? ` · Son ${t.daysLeft} gün` : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <article className="ac-card" style={{ ['--ac-accent' as string]: accent }}>
        <span className="ac-rail" />

        <div className="ac-date" aria-hidden>
          <span className="ac-date-month">{month}</span>
          <span className="ac-date-day">{day}</span>
        </div>

        <div className="ac-body">
          <div className="ac-meta">
            <span className="ac-chip" style={{ background: chip.bg, color: chip.text }}>
              <span className="ac-chip-dot" style={{ background: chip.dot }} />
              {status}
            </span>
            <span className="ac-category">{t.category || 'Genel'}</span>
            {isUrgent && (
              <span className="ac-urgent">
                <Flame className="h-2.5 w-2.5" />
                Son {t.daysLeft} gün
              </span>
            )}
          </div>

          <div className="ac-title-row">
            <span className="ac-icon">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="ac-title">{t.title}</h3>
          </div>

          {isStarted && (
            <div className="ac-progress">
              <div className="ac-progress-bar">
                <div className="ac-progress-fill" style={{ width: `${t.progress}%` }} />
              </div>
              <span className="ac-progress-num">{t.progress}%</span>
            </div>
          )}

          <dl className="ac-stats">
            <div>
              <dt><Hash className="h-3 w-3" /></dt>
              <dd><strong>{Math.max(t.attempt, 1)}</strong>/{t.maxAttempts}</dd>
            </div>
            {t.examOnly ? (
              <div>
                <dt><Clock className="h-3 w-3" /></dt>
                <dd><strong>{t.examDurationMinutes ?? '—'}</strong>dk</dd>
              </div>
            ) : t.daysLeft !== undefined ? (
              <div>
                <dt><Target className="h-3 w-3" /></dt>
                <dd><strong style={{ color: isUrgent ? '#b3261e' : undefined }}>{t.daysLeft}</strong>g kaldı</dd>
              </div>
            ) : t.questionCount ? (
              <div>
                <dt><ClipboardCheck className="h-3 w-3" /></dt>
                <dd><strong>{t.questionCount}</strong> soru</dd>
              </div>
            ) : null}
            <div className="ac-deadline-meta">
              <dt><CalendarDays className="h-3 w-3" /></dt>
              <dd><strong>{t.deadline || '—'}</strong></dd>
            </div>
          </dl>
        </div>

        <div className="ac-cta">
          <Play className="h-3.5 w-3.5" fill="currentColor" />
          <span>{isStarted || isFailedRetry ? 'Devam' : 'Başla'}</span>
          <ArrowRight className="h-3.5 w-3.5 ac-cta-arrow" />
        </div>
      </article>

      <style jsx>{`
        .ac-link {
          display: block;
          text-decoration: none;
          opacity: 0;
          animation: ac-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ac-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ac-card {
          position: relative;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 16px 20px 16px 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease;
        }
        .ac-card:hover {
          border-color: var(--ac-accent);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(10, 10, 10, 0.05);
        }
        .ac-rail {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--ac-accent);
        }

        .ac-date {
          width: 48px;
          height: 52px;
          border-radius: 10px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .ac-date-month {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #8a8578;
        }
        .ac-date-day {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .ac-body { min-width: 0; }

        .ac-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .ac-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }
        .ac-chip-dot { width: 5px; height: 5px; border-radius: 50%; }
        .ac-category {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
        }
        .ac-urgent {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          background: #fdf5f2;
          color: #b3261e;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .ac-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .ac-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #faf8f2;
          color: var(--ac-accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ac-title {
          font-family: var(--font-editorial, serif);
          font-size: 16px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.01em;
          line-height: 1.25;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .ac-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .ac-progress-bar {
          flex: 1;
          max-width: 200px;
          height: 4px;
          background: #ebe7df;
          border-radius: 2px;
          overflow: hidden;
        }
        .ac-progress-fill {
          height: 100%;
          background: var(--ac-accent);
          transition: width 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ac-progress-num {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }

        .ac-stats {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 0;
          flex-wrap: wrap;
        }
        .ac-stats > div {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #6b6a63;
          margin: 0;
        }
        .ac-stats dt { display: inline-flex; align-items: center; color: #8a8578; margin: 0; }
        .ac-stats dd { display: inline; margin: 0; font-variant-numeric: tabular-nums; }
        .ac-stats strong {
          font-family: var(--font-editorial, serif);
          font-weight: 500;
          color: #0a0a0a;
          font-size: 12px;
        }

        .ac-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: var(--ac-accent);
          color: #fafaf7;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ac-cta-arrow { transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        .ac-card:hover .ac-cta-arrow { transform: translateX(2px); }

        @media (max-width: 640px) {
          .ac-card {
            grid-template-columns: auto 1fr;
            grid-template-rows: auto auto;
            padding: 14px 16px 14px 20px;
            gap: 12px 14px;
          }
          .ac-cta {
            grid-column: 1 / -1;
            justify-content: center;
            width: 100%;
          }
          .ac-deadline-meta { display: none; }
        }

        @media (max-width: 420px) {
          .ac-title { font-size: 15px; }
          .ac-progress-bar { max-width: 100%; }
        }
      `}</style>
    </Link>
  );
}

// ── Completed Card ──
function CompletedCard({ training: t, delay = 0 }: { training: Training; delay?: number }) {
  const Icon = categoryIcon(t.category);
  const score = t.score ?? 0;
  const isTop = score >= 95;
  const scoreTier = score >= 95 ? 'Mükemmel' : score >= 85 ? 'Yüksek' : score >= 70 ? 'İyi' : score >= 60 ? 'Orta' : 'Düşük';

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="cc-link"
      aria-label={`${t.title} · Tamamlandı · %${score} (${scoreTier})`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <article className={`cc-card ${isTop ? 'cc-card-top' : ''}`}>
        <div className="cc-top">
          <div className="cc-icon">
            <Icon className="h-4 w-4" />
          </div>
          <div className="cc-score">
            <div className="cc-score-value">
              {isTop && <Award className="h-3.5 w-3.5" aria-hidden />}
              <span>{score}</span>
              <span className="cc-score-pct">%</span>
            </div>
            <span className="cc-score-tier">{scoreTier}</span>
          </div>
        </div>

        <h4 className="cc-title">{t.title}</h4>

        <div className="cc-meta">
          <span className="cc-category">{t.category || 'Genel'}</span>
          {t.deadline && <span className="cc-dot">·</span>}
          {t.deadline && <span className="cc-date">{t.deadline}</span>}
        </div>

        <div className="cc-bar">
          <div className="cc-bar-fill" style={{ width: `${score}%` }} />
        </div>

        <div className="cc-foot">
          <span>Detayları Gör</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </article>

      <style jsx>{`
        .cc-link {
          display: block;
          text-decoration: none;
          opacity: 0;
          animation: cc-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes cc-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cc-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px 20px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 14px;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease;
          height: 100%;
        }
        .cc-card:hover {
          border-color: #0a7a47;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(10, 122, 71, 0.08);
        }
        .cc-card-top {
          border-color: #c8e6d5;
          background: linear-gradient(180deg, #f7fcf8 0%, #ffffff 100%);
        }

        .cc-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .cc-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eaf6ef;
          color: #0a7a47;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cc-score { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .cc-score-value {
          display: flex;
          align-items: baseline;
          gap: 2px;
          font-family: var(--font-editorial, serif);
          font-size: 26px;
          font-weight: 500;
          font-variation-settings: 'opsz' 48, 'SOFT' 50;
          color: #0a7a47;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .cc-score-value :global(svg) { color: #b4820b; align-self: center; margin-right: 2px; }
        .cc-score-pct {
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          color: #6b6a63;
        }
        .cc-score-tier {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0a7a47;
        }

        .cc-title {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.005em;
          line-height: 1.3;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
        }

        .cc-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .cc-category {
          font-family: var(--font-display, system-ui);
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 10px;
          color: #8a8578;
        }
        .cc-dot { color: #c8c2b0; }

        .cc-bar {
          height: 3px;
          background: #ebe7df;
          border-radius: 2px;
          overflow: hidden;
        }
        .cc-bar-fill {
          height: 100%;
          background: #0a7a47;
          transition: width 1000ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cc-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px dashed #ebe7df;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 500;
          color: #6b6a63;
        }
        .cc-foot :global(svg) {
          color: #0a7a47;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cc-card:hover .cc-foot :global(svg) { transform: translateX(2px); }
      `}</style>
    </Link>
  );
}

// ── Archive Card (failed/locked) ──
function ArchiveCard({ training: t, variant, delay = 0 }: {
  training: Training;
  variant: 'failed' | 'locked';
  delay?: number;
}) {
  const Icon = categoryIcon(t.category);
  const isLocked = variant === 'locked';
  const accent = isLocked ? '#b4820b' : '#b3261e';
  const accentBg = isLocked ? '#fef6e7' : '#fdf5f2';
  const StateIcon = isLocked ? Lock : AlertOctagon;
  const stateLabel = isLocked ? 'Eğitim Kilitlendi' : 'Haklar Tükendi';
  const description = isLocked
    ? 'Yönetici tarafından kilitlenmiştir. Akademik birime başvurunuz.'
    : `${t.maxAttempts} deneme hakkının tamamı kullanıldı. Ek hak için yöneticinize başvurunuz.`;

  return (
    <Link
      href={`/staff/my-trainings/${t.id}`}
      className="av-link"
      style={{ animationDelay: `${delay}ms`, ['--av-accent' as string]: accent, ['--av-bg' as string]: accentBg }}
    >
      <article className="av-card">
        <span className="av-rail" />
        <div className="av-head">
          <div className="av-icon">
            <StateIcon className="h-4 w-4" />
          </div>
          <div className="av-head-body">
            <h4 className="av-title">{t.title}</h4>
            <span className="av-state">{stateLabel}</span>
          </div>
          {!isLocked && t.score !== undefined && (
            <div className="av-score">
              <span className="av-score-value">{t.score ?? 0}%</span>
              <span className="av-score-label">Son skor</span>
            </div>
          )}
        </div>

        <p className="av-desc">
          <span className="av-desc-icon"><Icon className="h-3 w-3" /></span>
          {description}
        </p>

        <div className="av-foot">
          <span className="av-foot-meta">
            {isLocked ? (t.category || 'Genel') : `Son tarih: ${t.deadline || '—'}`}
          </span>
          <span className="av-foot-cta">
            Yöneticiye Başvur
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </article>

      <style jsx>{`
        .av-link {
          display: block;
          text-decoration: none;
          opacity: 0;
          animation: av-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes av-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .av-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px 20px 16px 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .av-card:hover {
          border-color: var(--av-accent);
          transform: translateY(-1px);
        }
        .av-rail {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--av-accent);
        }

        .av-head {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .av-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--av-bg);
          color: var(--av-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .av-head-body { flex: 1; min-width: 0; }
        .av-title {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28;
          color: #0a0a0a;
          letter-spacing: -0.005em;
          line-height: 1.3;
          margin: 0 0 3px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .av-state {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--av-accent);
        }
        .av-score { text-align: right; flex-shrink: 0; }
        .av-score-value {
          display: block;
          font-family: var(--font-editorial, serif);
          font-size: 18px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: var(--av-accent);
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .av-score-label {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          margin-top: 3px;
        }

        .av-desc {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: #6b6a63;
          line-height: 1.55;
          margin: 0;
        }
        .av-desc-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: #8a8578;
        }

        .av-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px dashed #ebe7df;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-variant-numeric: tabular-nums;
        }
        .av-foot-meta { color: #8a8578; }
        .av-foot-cta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--av-accent);
          font-weight: 600;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .av-card:hover .av-foot-cta { transform: translateX(2px); }

        @media (max-width: 520px) {
          .av-score { display: none; }
        }
      `}</style>
    </Link>
  );
}

// ── Skeleton ──
function TrainingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Eğitimler yükleniyor" className="skel-page">
      <div className="skel-header">
        <div className="skel skel-bar-sm" style={{ width: 110 }} />
        <div className="skel skel-title" />
        <div className="skel skel-sub" />
      </div>

      <div className="skel-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-kpi">
            <div className="skel skel-bar-sm" style={{ width: '60%' }} />
            <div className="skel skel-bar-lg" />
          </div>
        ))}
      </div>

      <div className="skel skel-tabs" />

      <div className="skel-section">
        <div className="skel skel-bar-sm" style={{ width: 80 }} />
        <div className="skel-cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skel-card" />
          ))}
        </div>
      </div>

      <span className="sr-only">Eğitimler yükleniyor, lütfen bekleyin.</span>

      <style jsx>{`
        .skel-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          animation: skel-pulse 1.5s ease-in-out infinite;
        }
        @keyframes skel-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .skel { background: #ebe7df; border-radius: 6px; }
        .skel-bar-sm { height: 10px; }
        .skel-bar-lg { height: 28px; width: 60%; border-radius: 4px; }
        .skel-title { height: 44px; width: 220px; margin: 10px 0; }
        .skel-sub { height: 12px; width: 320px; max-width: 90%; }
        .skel-header { padding-bottom: 20px; border-bottom: 1px solid #ebe7df; }
        .skel-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .skel-kpi {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px;
          border: 1px solid #ebe7df;
          border-radius: 12px;
          background: #ffffff;
        }
        .skel-tabs { height: 48px; width: 260px; border-radius: 999px; }
        .skel-section { display: flex; flex-direction: column; gap: 12px; }
        .skel-cards { display: flex; flex-direction: column; gap: 10px; }
        .skel-card {
          height: 120px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #ebe7df;
        }
        @media (max-width: 700px) {
          .skel-kpis { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
