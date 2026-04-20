'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BookOpen, Clock, CheckCircle, XCircle, Calendar, Bell, ArrowRight, AlertTriangle, Play, Timer } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';
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

interface Notification {
  title: string;
  time: string;
  isRead: boolean;
}

interface DashboardData {
  stats: { assigned: number; inProgress: number; completed: number; failed: number; overallProgress: number };
  upcomingTrainings: Training[];
  recentActivity: Activity[];
  notifications: Notification[];
  urgentTraining?: { id: string; title: string; daysLeft: number } | null;
}

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number>(() =>
    targetIso ? Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)) : 0
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

const statusMap: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  in_progress: { label: 'Devam Ediyor', bg: '#fef6e7', text: '#6a4e11', dot: '#b4820b' },
  assigned:    { label: 'Atandı',       bg: '#eef2fb', text: '#1f3a7a', dot: '#2c55b8' },
};

const activityTone: Record<string, string> = {
  success: '#0a7a47',
  info: '#2c55b8',
  warning: '#b4820b',
  error: '#b3261e',
};

function CountdownWidget({ training }: { training: Training }) {
  const { days, hours, minutes, seconds, total } = useCountdown(training.endDateTime);
  if (total <= 0) return null;

  const isUrgent = days < 1;
  const accent = isUrgent ? '#b3261e' : days < 3 ? '#b4820b' : '#0a0a0a';
  const bg = isUrgent ? '#fdf5f2' : days < 3 ? '#fef6e7' : '#faf8f2';

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="sd-countdown" style={{ ['--c-accent' as string]: accent, ['--c-bg' as string]: bg }}>
      <div className="sd-countdown-head">
        <div className="sd-countdown-icon">
          <Timer className="h-4 w-4" />
        </div>
        <div className="sd-countdown-title">
          <span className="sd-countdown-eyebrow">Son Teslim Tarihi</span>
          <p title={training.title}>{training.title}</p>
        </div>
      </div>

      <div className="sd-countdown-digits">
        {days > 0 && (
          <>
            <TimeCell value={pad(days)} label="gün" />
            <span className="sd-countdown-sep">:</span>
          </>
        )}
        <TimeCell value={pad(hours)} label="saat" />
        <span className="sd-countdown-sep">:</span>
        <TimeCell value={pad(minutes)} label="dk" />
        <span className="sd-countdown-sep">:</span>
        <TimeCell value={pad(seconds)} label="sn" pulsing />
      </div>

      <style jsx>{`
        .sd-countdown {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 22px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 14px;
          position: relative;
          overflow: hidden;
        }
        .sd-countdown::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--c-accent);
        }
        .sd-countdown-head {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .sd-countdown-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--c-bg);
          color: var(--c-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sd-countdown-title { min-width: 0; }
        .sd-countdown-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 2px;
        }
        .sd-countdown-title p {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28;
          color: #0a0a0a;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sd-countdown-digits {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .sd-countdown-sep {
          font-family: var(--font-editorial, serif);
          font-size: 22px;
          color: #c8c2b0;
          margin-bottom: 14px;
        }
        @media (max-width: 600px) {
          .sd-countdown {
            flex-direction: column;
            align-items: flex-start;
          }
          .sd-countdown-digits { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}

function TimeCell({ value, label, pulsing }: { value: string; label: string; pulsing?: boolean }) {
  return (
    <div className="sd-tc">
      <div className={`sd-tc-value ${pulsing ? 'sd-tc-pulse' : ''}`}>{value}</div>
      <span className="sd-tc-label">{label}</span>
      <style jsx>{`
        .sd-tc { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .sd-tc-value {
          min-width: 44px;
          height: 40px;
          padding: 0 10px;
          border-radius: 8px;
          background: var(--c-bg);
          color: var(--c-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .sd-tc-pulse {
          animation: sd-tc-pulse 1s ease-in-out infinite;
        }
        @keyframes sd-tc-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .sd-tc-label {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
        }
      `}</style>
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFetch<DashboardData>('/api/staff/dashboard');

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="sd-page-empty">
        <p>{error}</p>
        <style jsx>{`
          .sd-page-empty { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #b3261e; font-family: var(--font-editorial, serif); font-size: 16px; }
        `}</style>
      </div>
    );
  }

  const stats = [
    { label: 'Atanan Eğitim', value: data?.stats?.assigned ?? 0,    icon: <BookOpen className="h-4 w-4" />,     tone: 'ink' as const    },
    { label: 'Devam Eden',    value: data?.stats?.inProgress ?? 0, icon: <Clock className="h-4 w-4" />,        tone: 'amber' as const  },
    { label: 'Tamamlanan',    value: data?.stats?.completed ?? 0,  icon: <CheckCircle className="h-4 w-4" />,  tone: 'ok' as const     },
    { label: 'Başarısız',     value: data?.stats?.failed ?? 0,     icon: <XCircle className="h-4 w-4" />,      tone: 'err' as const    },
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

  const circleCirc = 2 * Math.PI * 15.5; // ~97.39

  return (
    <div className="sd-page">
      <MandatoryFeedbackBanner />

      {/* ── Greeting + overall progress ── */}
      <header className="sd-greeting">
        <div className="sd-greeting-main">
          <span className="sd-eyebrow">{greeting}</span>
          <h1 className="sd-title">
            Hoş geldin, <em>{user?.firstName ?? 'Kullanıcı'}</em>
          </h1>
          <p className="sd-subtitle">Güncel eğitim ve sınav durumuna genel bakış.</p>
        </div>

        <div className="sd-progress-wrap">
          <div className="sd-progress-ring-box">
            <svg viewBox="0 0 36 36" className="sd-progress-ring" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ebe7df" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke="#0a7a47" strokeWidth="2" strokeLinecap="round"
                strokeDasharray={circleCirc}
                strokeDashoffset={circleCirc - (circleCirc * overallProgress / 100)}
                transform="rotate(-90 18 18)"
                className="sd-progress-arc"
              />
            </svg>
            <div className="sd-progress-text">
              <span className="sd-progress-value">{overallProgress}</span>
              <span className="sd-progress-pct">%</span>
            </div>
          </div>
          <span className="sd-progress-label">Genel İlerleme</span>
        </div>
      </header>

      {/* ── Urgent alert ── */}
      {urgentTraining && (
        <div className="sd-urgent">
          <div className="sd-urgent-icon">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="sd-urgent-body">
            <h3>
              <em>{urgentTraining.title}</em> bitiş tarihi <strong>{urgentTraining.daysLeft} gün</strong> sonra
            </h3>
            <p>Eğitimi tamamlamanız gerekmektedir.</p>
          </div>
          <Link href={`/staff/my-trainings/${urgentTraining.id}`} className="sd-urgent-cta">
            <Play className="h-4 w-4" />
            <span>Devam Et</span>
          </Link>
        </div>
      )}

      {/* ── Countdown ── */}
      {upcomingTrainings.length > 0 && upcomingTrainings[0].endDateTime && upcomingTrainings[0].daysLeft <= 14 && (
        <CountdownWidget training={upcomingTrainings[0]} />
      )}

      {/* ── Stats ── */}
      <section className="sd-stats" aria-label="Eğitim özeti">
        {stats.map((s, i) => (
          <StatTile key={s.label} {...s} delay={i * 40} />
        ))}
      </section>

      {/* ── Grid: upcoming + right column ── */}
      <div className="sd-grid">
        {/* Upcoming Trainings */}
        <section className="sd-card sd-card-lg">
          <div className="sd-card-head">
            <div>
              <span className="sd-card-eyebrow">Yaklaşan</span>
              <h2 className="sd-card-title">Eğitimlerim</h2>
            </div>
            <Link href="/staff/my-trainings" className="sd-card-link">
              Tümü <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {upcomingTrainings.length === 0 ? (
            <div className="sd-card-empty">
              <Calendar className="h-6 w-6" />
              <p>Yaklaşan eğitiminiz yok.</p>
            </div>
          ) : (
            <ul className="sd-training-list">
              {upcomingTrainings.map((t, i) => {
                const st = statusMap[t.status] || statusMap.assigned;
                const isUrgent = (t.daysLeft ?? 99) <= 3;
                const isSoon = (t.daysLeft ?? 99) <= 7;
                const parts = t.deadline?.split('.') ?? [];
                const day = parts[0] ?? '--';
                const monthNum = parseInt(parts[1] ?? '0', 10);
                const monthName = ['', 'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'][monthNum] ?? '---';

                return (
                  <li key={t.id} style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
                    <Link href={`/staff/my-trainings/${t.id}`} className="sd-training">
                      <div className={`sd-training-date ${isUrgent ? 'sd-training-date-urg' : ''}`}>
                        <span className="sd-td-month">{monthName}</span>
                        <span className="sd-td-day">{day}</span>
                      </div>

                      <div className="sd-training-body">
                        <h4>{t.title}</h4>
                        <div className="sd-training-progress">
                          <div className="sd-progress-bar">
                            <div className="sd-progress-fill" style={{ width: `${t.progress ?? 0}%` }} />
                          </div>
                          <span className="sd-progress-num">{t.progress ?? 0}%</span>
                        </div>
                      </div>

                      <div className="sd-training-meta">
                        <span className="sd-chip" style={{ background: st.bg, color: st.text }}>
                          <span className="sd-chip-dot" style={{ background: st.dot }} />
                          {st.label}
                        </span>
                        {isSoon && (
                          <span className={`sd-days ${isUrgent ? 'sd-days-urg' : 'sd-days-warn'}`}>
                            {t.daysLeft} gün
                          </span>
                        )}
                        <ArrowRight className="sd-arrow" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right column: notifications + activity */}
        <div className="sd-side">
          {/* Notifications */}
          <section className="sd-card">
            <div className="sd-card-head">
              <div className="sd-card-head-title">
                <Bell className="h-3.5 w-3.5" />
                <h2 className="sd-card-subtitle">Bildirimler</h2>
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="sd-dot-count">{notifications.filter(n => !n.isRead).length}</span>
                )}
              </div>
              <Link href="/staff/notifications" className="sd-card-link">
                Tümü <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {notifications.length === 0 ? (
              <div className="sd-card-empty sd-card-empty-sm">
                <p>Yeni bildirim yok.</p>
              </div>
            ) : (
              <ul className="sd-notifs">
                {notifications.map((n, i) => (
                  <li key={i} className={`sd-notif ${!n.isRead ? 'sd-notif-new' : ''}`}>
                    {!n.isRead && <span className="sd-notif-pulse" />}
                    <div>
                      <p className="sd-notif-title">{n.title}</p>
                      <p className="sd-notif-time">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent activity — vertical timeline */}
          <section className="sd-card">
            <div className="sd-card-head">
              <h2 className="sd-card-subtitle">Son Aktivitelerim</h2>
            </div>

            {recentActivity.length === 0 ? (
              <div className="sd-card-empty sd-card-empty-sm">
                <p>Henüz aktivite yok.</p>
              </div>
            ) : (
              <ul className="sd-timeline">
                {recentActivity.map((a, i) => (
                  <li key={i} className="sd-tl-item">
                    <span
                      className="sd-tl-dot"
                      style={{ background: activityTone[a.type] ?? '#2c55b8' }}
                    />
                    <div className="sd-tl-body">
                      <p className="sd-tl-text">{a.text}</p>
                      <p className="sd-tl-time">{a.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .sd-page { display: flex; flex-direction: column; gap: 24px; }

        /* ── Greeting ── */
        .sd-greeting {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 32px;
          background: linear-gradient(135deg, #faf8f2 0%, #f4efdf 100%);
          border: 1px solid #ebe7df;
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          color: #0a0a0a;
        }
        .sd-greeting::before {
          content: '';
          position: absolute;
          top: -60%;
          right: -20%;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(10, 122, 71, 0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .sd-greeting::after {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #0a7a47;
        }
        .sd-greeting-main { position: relative; z-index: 1; flex: 1; min-width: 0; }
        .sd-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 10px;
        }
        .sd-title {
          font-family: var(--font-editorial, serif);
          font-size: clamp(26px, 4vw, 38px);
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          letter-spacing: -0.025em;
          line-height: 1.1;
          margin: 0;
          color: #0a0a0a;
        }
        .sd-title em {
          font-style: italic;
          color: #0a7a47;
          font-variation-settings: 'opsz' 72, 'SOFT' 100;
        }
        .sd-subtitle {
          font-size: 13px;
          color: #6b6a63;
          margin: 8px 0 0;
          max-width: 420px;
        }

        /* progress ring */
        .sd-progress-wrap {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sd-progress-ring-box {
          position: relative;
          width: 84px;
          height: 84px;
          flex-shrink: 0;
        }
        .sd-progress-ring {
          width: 100%;
          height: 100%;
          display: block;
        }
        .sd-progress-arc {
          transition: stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sd-progress-text {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1px;
          color: #0a0a0a;
        }
        .sd-progress-value {
          font-family: var(--font-editorial, serif);
          font-size: 22px;
          font-weight: 500;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .sd-progress-pct {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #8a8578;
          line-height: 1;
          align-self: flex-end;
          margin-bottom: 3px;
        }
        .sd-progress-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
          white-space: nowrap;
        }

        /* ── Urgent alert ── */
        .sd-urgent {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background: #fdf5f2;
          border: 1px solid #e9c9c0;
          border-radius: 14px;
          position: relative;
          overflow: hidden;
        }
        .sd-urgent::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #b3261e;
        }
        .sd-urgent-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #b3261e;
          color: #fafaf7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sd-urgent-body { flex: 1; min-width: 0; }
        .sd-urgent-body h3 {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          color: #7a1d14;
          margin: 0 0 2px;
          font-variation-settings: 'opsz' 28;
        }
        .sd-urgent-body h3 em { font-style: italic; }
        .sd-urgent-body h3 strong { font-weight: 600; }
        .sd-urgent-body p { font-size: 12px; color: #7a1d14; opacity: 0.75; margin: 0; }
        .sd-urgent-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: #b3261e;
          color: #fafaf7;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          flex-shrink: 0;
          transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sd-urgent-cta:hover { background: #8f1e17; }
        .sd-urgent-cta:active { transform: scale(0.97); }

        /* ── Stats grid ── */
        .sd-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        /* ── Content grid ── */
        .sd-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 18px;
        }
        .sd-side { display: flex; flex-direction: column; gap: 18px; }

        /* ── Card shell ── */
        .sd-card {
          padding: 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
        }
        .sd-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .sd-card-head-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b6a63;
        }
        .sd-card-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 2px;
        }
        .sd-card-title {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .sd-card-subtitle {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a0a0a;
          margin: 0;
        }
        .sd-dot-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          background: #b3261e;
          color: #fafaf7;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .sd-card-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          color: #6b6a63;
          background: #faf8f2;
          text-decoration: none;
          transition: background 160ms ease, color 160ms ease;
        }
        .sd-card-link:hover { background: #0a0a0a; color: #fafaf7; }

        .sd-card-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 30px 20px;
          color: #8a8578;
          text-align: center;
        }
        .sd-card-empty p { font-size: 13px; margin: 0; }
        .sd-card-empty-sm { padding: 16px 10px; }
        .sd-card-empty-sm p { font-size: 12px; }

        /* ── Training list ── */
        .sd-training-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .sd-training-list li {
          opacity: 0;
          animation: sd-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes sd-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sd-training {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #ebe7df;
          background: #ffffff;
          text-decoration: none;
          transition: border-color 180ms ease, background 180ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sd-training:hover {
          border-color: #0a0a0a;
          background: #faf8f2;
        }
        .sd-training:hover :global(.sd-arrow) { opacity: 1; transform: translateX(2px); }

        .sd-training-date {
          flex-shrink: 0;
          width: 48px;
          height: 52px;
          border-radius: 10px;
          background: #faf8f2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border: 1px solid #ebe7df;
        }
        .sd-training-date-urg { background: #fdf5f2; border-color: #e9c9c0; }
        .sd-td-month {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #8a8578;
        }
        .sd-training-date-urg .sd-td-month { color: #b3261e; }
        .sd-td-day {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .sd-training-date-urg .sd-td-day { color: #b3261e; }

        .sd-training-body { flex: 1; min-width: 0; }
        .sd-training-body h4 {
          font-family: var(--font-editorial, serif);
          font-size: 14px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a0a0a;
          margin: 0 0 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sd-training-progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sd-progress-bar {
          flex: 1;
          max-width: 160px;
          height: 4px;
          background: #ebe7df;
          border-radius: 2px;
          overflow: hidden;
        }
        .sd-progress-fill {
          height: 100%;
          background: #0a0a0a;
          transition: width 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sd-progress-num {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }

        .sd-training-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .sd-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }
        .sd-chip-dot { width: 5px; height: 5px; border-radius: 50%; }
        .sd-days {
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          font-variant-numeric: tabular-nums;
        }
        .sd-days-warn { background: #fef6e7; color: #6a4e11; }
        .sd-days-urg { background: #fdf5f2; color: #b3261e; }
        :global(.sd-arrow) {
          width: 16px;
          height: 16px;
          color: #8a8578;
          opacity: 0;
          transition: opacity 200ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ── Notifications ── */
        .sd-notifs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .sd-notif {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: transparent;
          transition: background 160ms ease;
        }
        .sd-notif-new { background: #faf8f2; }
        .sd-notif-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0a7a47;
          flex-shrink: 0;
          margin-top: 6px;
          animation: sd-pulse 1.5s ease-in-out infinite;
        }
        @keyframes sd-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }
        .sd-notif-title {
          font-size: 12px;
          font-weight: 500;
          color: #0a0a0a;
          margin: 0 0 2px;
          line-height: 1.4;
        }
        .sd-notif-time {
          font-size: 10px;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
          margin: 0;
        }

        /* ── Timeline ── */
        .sd-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; position: relative; }
        .sd-timeline::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 6px;
          bottom: 6px;
          width: 1px;
          background: #ebe7df;
        }
        .sd-tl-item {
          display: flex;
          gap: 14px;
          position: relative;
        }
        .sd-tl-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
          box-shadow: 0 0 0 3px #ffffff;
          z-index: 1;
        }
        .sd-tl-body { flex: 1; min-width: 0; }
        .sd-tl-text {
          font-size: 12px;
          line-height: 1.5;
          color: #0a0a0a;
          margin: 0;
        }
        .sd-tl-time {
          font-size: 10px;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
          margin: 2px 0 0;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .sd-grid { grid-template-columns: 1fr; }
          .sd-stats { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 700px) {
          .sd-greeting {
            padding: 22px 20px 22px 22px;
            flex-direction: column;
            align-items: stretch;
            gap: 18px;
          }
          .sd-progress-wrap {
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 14px;
            padding-top: 14px;
            border-top: 1px dashed #ebe7df;
          }
          .sd-progress-ring-box { width: 68px; height: 68px; }
          .sd-progress-value { font-size: 18px; }
          .sd-progress-pct { font-size: 10px; margin-bottom: 2px; }
          .sd-progress-label { margin: 0; }

          .sd-urgent { flex-wrap: wrap; }
          .sd-urgent-cta { width: 100%; justify-content: center; margin-top: 4px; }

          .sd-training { gap: 12px; padding: 10px 12px; }
          .sd-training-meta { flex-direction: column; align-items: flex-end; gap: 4px; }
          .sd-days { display: none; } /* keep chip only */
          .sd-progress-bar { max-width: 100px; }

          .sd-card { padding: 20px; }
        }

        @media (max-width: 420px) {
          .sd-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ── Stat Tile ──
function StatTile({
  label, value, icon, tone, delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'ink' | 'ok' | 'amber' | 'err';
  delay?: number;
}) {
  const accent = { ink: '#0a0a0a', ok: '#0a7a47', amber: '#b4820b', err: '#b3261e' }[tone];

  return (
    <div className="st-tile" style={{ animationDelay: `${delay}ms` }}>
      <div className="st-rail" />
      <div className="st-head">
        <span className="st-icon">{icon}</span>
        <span className="st-label">{label}</span>
      </div>
      <div className="st-number">{value.toLocaleString('tr-TR')}</div>

      <style jsx>{`
        .st-tile {
          position: relative;
          padding: 20px 22px 20px 26px;
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #ebe7df;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(10, 10, 10, 0.03);
          overflow: hidden;
          opacity: 0;
          animation: st-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes st-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .st-tile:hover { border-color: #d9d4c4; transform: translateY(-1px); }
        .st-rail {
          position: absolute;
          left: 0;
          top: 14px;
          bottom: 14px;
          width: 3px;
          background: ${accent};
          border-radius: 0 2px 2px 0;
        }
        .st-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .st-icon { display: inline-flex; color: ${accent}; opacity: 0.75; }
        .st-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b6a63;
        }
        .st-number {
          font-family: var(--font-editorial, serif);
          font-size: 36px;
          font-weight: 500;
          font-variation-settings: 'opsz' 56, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          letter-spacing: -0.025em;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}
