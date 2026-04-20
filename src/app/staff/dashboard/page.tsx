'use client';

/**
 * Staff Dashboard — "Clinical Editorial" redesign.
 * Notifications + Calendar + SMG + Profile ile aynı dil:
 * cream + ink (navy) + gold + serif display + mono caps + radial dot bg.
 * PR #21'deki widget mimarisi (countdown, urgent, ring progress, training kartları, timeline) korundu.
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  BookOpen, Clock, CheckCircle, XCircle, Bell, ArrowRight,
  AlertTriangle, Play, Timer, Calendar as CalendarIcon,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { MandatoryFeedbackBanner } from '@/components/shared/mandatory-feedback-banner';

interface Training {
  id: string;
  title: string;
  deadline: string;
  endDateTime: string | null;
  status: string;
  daysLeft: number;
  progress: number;
}

interface Activity {
  text: string;
  time: string;
  type: string;
}

interface NotificationItem {
  title: string;
  time: string;
  isRead: boolean;
}

interface DashboardData {
  stats: { assigned: number; inProgress: number; completed: number; failed: number; overallProgress: number };
  upcomingTrainings: Training[];
  recentActivity: Activity[];
  notifications: NotificationItem[];
  urgentTraining?: { id: string; title: string; daysLeft: number } | null;
}

/* ─── Editorial palette ─── */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

const STATUS: Record<string, { label: string; ink: string; bg: string; dot: string }> = {
  in_progress: { label: 'DEVAM',  ink: '#6a4e11', bg: '#fef6e7', dot: '#b4820b' },
  assigned:    { label: 'ATANDI', ink: '#1f3a7a', bg: '#eef2fb', dot: '#2c55b8' },
};

const ACTIVITY_TONE: Record<string, string> = {
  success: '#0a7a47',
  info:    '#2c55b8',
  warning: '#b4820b',
  error:   '#b3261e',
};

/* ─── Hooks ─── */

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number>(() =>
    targetIso ? Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return { days, hours, minutes, seconds, total: remaining };
}

/* ─── Page ─── */

export default function StaffDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFetch<DashboardData>('/api/staff/dashboard');

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

  const stats = [
    { label: 'Atanan',      value: data?.stats?.assigned   ?? 0, icon: BookOpen,    tone: INK,       num: '01' },
    { label: 'Devam Eden',  value: data?.stats?.inProgress ?? 0, icon: Clock,       tone: '#b4820b', num: '02' },
    { label: 'Tamamlanan',  value: data?.stats?.completed  ?? 0, icon: CheckCircle, tone: '#0a7a47', num: '03' },
    { label: 'Başarısız',   value: data?.stats?.failed     ?? 0, icon: XCircle,     tone: '#b3261e', num: '04' },
  ];

  const upcomingTrainings = data?.upcomingTrainings ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const notifications = data?.notifications ?? [];
  const overallProgress = data?.stats?.overallProgress ?? 0;
  const urgentTraining = data?.urgentTraining;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  })();

  const circleCirc = 2 * Math.PI * 15.5;

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
      <div className="relative px-6 sm:px-10 lg:px-16 pt-5 pb-16">
        <MandatoryFeedbackBanner />

        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-5"
          style={{ borderColor: INK }}
        >
          <div className="flex items-end gap-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              № 01 · Panel
            </p>
            <h1
              className="text-[36px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {greeting}, <span style={{ fontStyle: 'italic', color: OLIVE }}>{user?.firstName ?? 'Kullanıcı'}</span>
              <span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          {/* Overall progress ring */}
          <div className="flex items-center gap-3">
            <div className="relative" style={{ width: 76, height: 76 }}>
              <svg viewBox="0 0 36 36" className="block w-full h-full" aria-hidden>
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={RULE} strokeWidth="2" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={OLIVE} strokeWidth="2" strokeLinecap="round"
                  strokeDasharray={circleCirc}
                  strokeDashoffset={circleCirc - (circleCirc * overallProgress / 100)}
                  transform="rotate(-90 18 18)"
                  style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
              </svg>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center leading-none"
                style={{ paddingTop: '2px' }}
              >
                <span
                  className="text-[24px] font-semibold tabular-nums tracking-[-0.025em] leading-none"
                  style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                >
                  {overallProgress}
                  <span
                    className="text-[11px] font-semibold ml-0.5 align-top"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    %
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Genel
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                İlerleme
              </span>
            </div>
          </div>
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Eğitim ve sınav durumuna genel bakış
        </p>

        {isLoading ? (
          <DashboardSkeleton />
        ) : error ? (
          <p className="mt-10 text-[13px]" style={{ color: '#b3261e' }}>{error}</p>
        ) : (
          <>
            {/* ───── Urgent training alert ───── */}
            {urgentTraining && (
              <div
                className="mt-8 grid items-center gap-4"
                style={{
                  gridTemplateColumns: '4px 44px 1fr max-content',
                  backgroundColor: '#fdf5f2',
                  border: `1px solid #e9c9c0`,
                  borderRadius: '4px',
                  padding: '14px 16px 14px 0',
                }}
              >
                <span style={{ backgroundColor: '#b3261e', alignSelf: 'stretch', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }} />
                <div
                  className="flex items-center justify-center"
                  style={{ width: 36, height: 36, backgroundColor: '#b3261e', borderRadius: '2px', marginLeft: '12px' }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: CREAM }} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Acil — Son {urgentTraining.daysLeft} gün
                  </p>
                  <p
                    className="mt-1 text-[15px] font-semibold tracking-[-0.01em] truncate"
                    style={{ color: '#7a1d14', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    {urgentTraining.title}
                  </p>
                </div>
                <Link
                  href={`/staff/my-trainings/${urgentTraining.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] mr-3"
                  style={{
                    color: CREAM,
                    backgroundColor: '#b3261e',
                    borderRadius: '2px',
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  <Play className="h-3 w-3" />
                  Devam Et
                </Link>
              </div>
            )}

            {/* ───── Countdown ───── */}
            {upcomingTrainings.length > 0 && upcomingTrainings[0].endDateTime && upcomingTrainings[0].daysLeft <= 14 && (
              <div className="mt-8">
                <CountdownPanel training={upcomingTrainings[0]} />
              </div>
            )}

            {/* ───── Stats strip ───── */}
            <section className="mt-10">
              <header
                className="grid items-end gap-4 pb-3 border-b"
                style={{ gridTemplateColumns: '40px 1fr', borderColor: RULE }}
              >
                <span
                  className="text-[11px] font-semibold tracking-[0.2em]"
                  style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  I.
                </span>
                <div>
                  <h2
                    className="text-[20px] leading-tight font-semibold tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Eğitim özeti
                  </h2>
                  <p
                    className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Atama · ilerleme · sonuçlar
                  </p>
                </div>
              </header>

              <div
                className="mt-5 grid"
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${RULE}`,
                  borderRadius: '4px',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                }}
              >
                {stats.map((s, i) => (
                  <StatTile key={s.label} {...s} last={i === stats.length - 1} />
                ))}
              </div>
            </section>

            {/* ───── Two-column: trainings + side ───── */}
            <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* Upcoming trainings */}
              <div>
                <header
                  className="grid items-end gap-4 pb-3 border-b"
                  style={{ gridTemplateColumns: '40px 1fr max-content', borderColor: RULE }}
                >
                  <span
                    className="text-[11px] font-semibold tracking-[0.2em]"
                    style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    II.
                  </span>
                  <div>
                    <h2
                      className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                      style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                    >
                      Yaklaşan eğitimlerim
                    </h2>
                    <p
                      className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      İlerleme + son tarih
                    </p>
                  </div>
                  <Link
                    href="/staff/my-trainings"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      color: INK,
                      border: `1px solid ${INK}`,
                      borderRadius: '2px',
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    }}
                  >
                    Tümü
                    <ArrowRight className="h-3 w-3" style={{ color: GOLD }} />
                  </Link>
                </header>

                {upcomingTrainings.length === 0 ? (
                  <EmptyBlock
                    icon={CalendarIcon}
                    title="Yaklaşan eğitimin yok"
                    description="Yöneticin sana yeni eğitim atadığında burada görünecek."
                  />
                ) : (
                  <ul className="mt-5 space-y-2.5">
                    {upcomingTrainings.map((t, i) => (
                      <TrainingRow key={t.id} t={t} index={i + 1} />
                    ))}
                  </ul>
                )}
              </div>

              {/* Side: notifications + activity */}
              <aside className="space-y-10">
                {/* Notifications */}
                <div>
                  <header
                    className="grid items-end gap-4 pb-3 border-b"
                    style={{ gridTemplateColumns: '40px 1fr max-content', borderColor: RULE }}
                  >
                    <span
                      className="text-[11px] font-semibold tracking-[0.2em]"
                      style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      III.
                    </span>
                    <div>
                      <h2
                        className="text-[18px] leading-tight font-semibold tracking-[-0.02em]"
                        style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                      >
                        Bildirimler
                      </h2>
                      <p
                        className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                      >
                        {notifications.filter(n => !n.isRead).length} okunmamış
                      </p>
                    </div>
                    <Link
                      href="/staff/notifications"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        color: INK_SOFT,
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      }}
                    >
                      Tümü
                      <ArrowRight className="h-3 w-3" style={{ color: GOLD }} />
                    </Link>
                  </header>

                  {notifications.length === 0 ? (
                    <EmptyBlock icon={Bell} title="Yeni bildirim yok" description="Yeni bildirim geldiğinde burada listelenir." compact />
                  ) : (
                    <ul
                      className="mt-4"
                      style={{
                        backgroundColor: '#ffffff',
                        border: `1px solid ${RULE}`,
                        borderRadius: '4px',
                      }}
                    >
                      {notifications.slice(0, 4).map((n, i, arr) => (
                        <li
                          key={i}
                          className="grid items-start gap-3 px-3 py-3"
                          style={{
                            gridTemplateColumns: '24px 1fr max-content',
                            borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${RULE}`,
                            backgroundColor: !n.isRead ? 'rgba(26, 58, 40, 0.025)' : 'transparent',
                          }}
                        >
                          <span
                            className="text-[10px] tabular-nums font-semibold mt-0.5"
                            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                          >
                            {(i + 1).toString().padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p
                              className="text-[12px] leading-snug truncate"
                              style={{
                                color: INK,
                                fontWeight: !n.isRead ? 600 : 400,
                                fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                              }}
                            >
                              {n.title}
                            </p>
                            <p
                              className="text-[10px] uppercase tracking-[0.12em] mt-1"
                              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                            >
                              {n.time}
                            </p>
                          </div>
                          <span
                            aria-hidden
                            className="mt-1.5 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: !n.isRead ? OLIVE : 'transparent' }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Activity timeline */}
                <div>
                  <header
                    className="grid items-end gap-4 pb-3 border-b"
                    style={{ gridTemplateColumns: '40px 1fr', borderColor: RULE }}
                  >
                    <span
                      className="text-[11px] font-semibold tracking-[0.2em]"
                      style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      IV.
                    </span>
                    <div>
                      <h2
                        className="text-[18px] leading-tight font-semibold tracking-[-0.02em]"
                        style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                      >
                        Son aktivite
                      </h2>
                      <p
                        className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                      >
                        Hareket günlüğü
                      </p>
                    </div>
                  </header>

                  {recentActivity.length === 0 ? (
                    <EmptyBlock icon={Clock} title="Henüz aktivite yok" description="İlk hareketin sonrasında burada görünür." compact />
                  ) : (
                    <ul
                      className="mt-4"
                      style={{
                        backgroundColor: '#ffffff',
                        border: `1px solid ${RULE}`,
                        borderRadius: '4px',
                      }}
                    >
                      {recentActivity.slice(0, 6).map((a, i, arr) => (
                        <li
                          key={i}
                          className="grid items-start gap-3 px-3 py-3"
                          style={{
                            gridTemplateColumns: '8px 1fr max-content',
                            borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${RULE}`,
                          }}
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: ACTIVITY_TONE[a.type] ?? '#2c55b8',
                            }}
                          />
                          <p
                            className="text-[12px] leading-snug"
                            style={{
                              color: INK,
                              fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                              fontWeight: 500,
                            }}
                          >
                            {a.text}
                          </p>
                          <p
                            className="text-[10px] uppercase tracking-[0.12em] tabular-nums mt-0.5"
                            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                          >
                            {a.time}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function StatTile({
  label, value, icon: Icon, tone, num, last,
}: {
  label: string; value: number; icon: typeof BookOpen;
  tone: string; num: string; last: boolean;
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
      <div
        className="text-[36px] font-semibold tabular-nums leading-none tracking-[-0.025em]"
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {value.toLocaleString('tr-TR')}
      </div>
    </div>
  );
}

function TrainingRow({ t, index }: { t: Training; index: number }) {
  const st = STATUS[t.status] ?? STATUS.assigned;
  const isUrgent = (t.daysLeft ?? 99) <= 3;
  const isSoon = (t.daysLeft ?? 99) <= 7;
  const parts = t.deadline?.split('.') ?? [];
  const day = parts[0] ?? '--';
  const monthNum = parseInt(parts[1] ?? '0', 10);
  const monthName = ['', 'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'][monthNum] ?? '---';

  return (
    <li>
      <Link
        href={`/staff/my-trainings/${t.id}`}
        className="group grid items-center overflow-hidden focus:outline-none"
        style={{
          gridTemplateColumns: '40px 56px 1fr max-content',
          backgroundColor: '#ffffff',
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '4px',
          borderTopColor: RULE,
          borderRightColor: RULE,
          borderBottomColor: RULE,
          borderLeftColor: isUrgent ? '#b3261e' : st.dot,
          borderStyle: 'solid',
          borderRadius: '4px',
          transition: 'box-shadow 160ms ease, transform 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 0 0 ' + INK; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Index */}
        <div className="flex items-center justify-center py-4 border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {index.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Date stack */}
        <div className="flex flex-col items-center justify-center py-3 border-r" style={{ borderColor: RULE }}>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: isUrgent ? '#b3261e' : INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {monthName}
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
        <div className="min-w-0 px-4 py-3">
          <p
            className="truncate text-[14px] font-semibold tracking-[-0.01em]"
            style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {t.title}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <div
              className="relative h-[3px] flex-1 max-w-[160px] overflow-hidden"
              style={{ backgroundColor: RULE, borderRadius: '1px' }}
            >
              <div
                className="absolute left-0 top-0 h-full"
                style={{
                  width: `${t.progress ?? 0}%`,
                  backgroundColor: OLIVE,
                  transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
            <span
              className="text-[10px] tabular-nums font-semibold"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              {t.progress ?? 0}%
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 px-4 py-3 border-l" style={{ borderColor: RULE }}>
          <span
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
            style={{
              color: st.ink, backgroundColor: st.bg,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
            {st.label}
          </span>
          {isSoon && (
            <span
              className="text-[10px] font-semibold tabular-nums tracking-[0.12em]"
              style={{
                color: isUrgent ? '#b3261e' : '#6a4e11',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              {t.daysLeft}G
            </span>
          )}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            style={{ color: GOLD }}
          />
        </div>
      </Link>
    </li>
  );
}

function CountdownPanel({ training }: { training: Training }) {
  const { days, hours, minutes, seconds, total } = useCountdown(training.endDateTime);
  if (total <= 0) return null;

  const isUrgent = days < 1;
  const accent = isUrgent ? '#b3261e' : days < 3 ? '#b4820b' : OLIVE;
  const accentBg = isUrgent ? '#fdf5f2' : days < 3 ? '#fef6e7' : '#e8efe9';
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="grid items-center gap-4 p-4 sm:p-5"
      style={{
        gridTemplateColumns: '4px 36px 1fr max-content',
        backgroundColor: '#ffffff',
        border: `1px solid ${RULE}`,
        borderRadius: '4px',
      }}
    >
      <span style={{ backgroundColor: accent, alignSelf: 'stretch', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }} />
      <div
        className="flex items-center justify-center"
        style={{ width: 36, height: 36, backgroundColor: accentBg, borderRadius: '2px' }}
      >
        <Timer className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: accent, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Son teslim tarihi
        </p>
        <p
          className="mt-1 text-[15px] font-semibold tracking-[-0.01em] truncate"
          style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          title={training.title}
        >
          {training.title}
        </p>
      </div>
      <div className="flex items-end gap-1.5">
        {days > 0 && <TimeCell value={pad(days)} label="gün" accent={accent} bg={accentBg} />}
        {days > 0 && <Sep />}
        <TimeCell value={pad(hours)} label="sa" accent={accent} bg={accentBg} />
        <Sep />
        <TimeCell value={pad(minutes)} label="dk" accent={accent} bg={accentBg} />
        <Sep />
        <TimeCell value={pad(seconds)} label="sn" accent={accent} bg={accentBg} pulsing />
      </div>
    </div>
  );
}

function TimeCell({
  value, label, accent, bg, pulsing,
}: { value: string; label: string; accent: string; bg: string; pulsing?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-center px-2"
        style={{
          minWidth: 36, height: 32,
          backgroundColor: bg,
          color: accent,
          borderRadius: '2px',
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
          fontSize: '18px', fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          animation: pulsing ? 'sd-pulse 1s ease-in-out infinite' : undefined,
        }}
      >
        {value}
      </div>
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {label}
      </span>
      <style jsx>{`
        @keyframes sd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}

function Sep() {
  return (
    <span
      className="pb-3 px-0.5"
      style={{
        color: RULE,
        fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
        fontSize: '20px',
      }}
    >
      :
    </span>
  );
}

function EmptyBlock({
  icon: Icon, title, description, compact,
}: { icon: typeof Bell; title: string; description: string; compact?: boolean }) {
  return (
    <div
      className={`mt-5 flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'}`}
      style={{
        border: `1px dashed ${RULE}`,
        borderRadius: '4px',
        backgroundColor: 'rgba(255,255,255,0.5)',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: compact ? 32 : 40,
          height: compact ? 32 : 40,
          backgroundColor: CREAM,
          border: `1px solid ${RULE}`,
          borderRadius: '2px',
        }}
      >
        <Icon style={{ width: compact ? 14 : 18, height: compact ? 14 : 18, color: INK_SOFT }} />
      </div>
      <p
        className={`mt-3 font-semibold tracking-[-0.01em] ${compact ? 'text-[13px]' : 'text-[15px]'}`}
        style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {title}
      </p>
      <p className={`mt-1 max-w-xs ${compact ? 'text-[11px]' : 'text-[12px]'}`} style={{ color: INK_SOFT }}>
        {description}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-10 space-y-8">
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
          ))}
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
