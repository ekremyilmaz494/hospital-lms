'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BookOpen, Clock, CheckCircle, XCircle, Calendar, Bell, ArrowRight, AlertTriangle, Play, Timer } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';

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

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
};

const typeColors: Record<string, string> = { success: 'var(--color-success)', info: 'var(--color-info)', warning: 'var(--color-warning)', error: 'var(--color-error)' };

function CountdownWidget({ training }: { training: Training }) {
  const { days, hours, minutes, seconds, total } = useCountdown(training.endDateTime);
  if (total <= 0) return null;

  const isUrgent = days < 1;
  const accentColor = isUrgent ? 'var(--color-error)' : days < 3 ? 'var(--color-warning)' : 'var(--color-primary)';
  const accentBg = isUrgent ? 'var(--color-error-bg)' : days < 3 ? 'var(--color-warning-bg)' : 'var(--color-primary-light)';

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <BlurFade delay={0.08}>
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-6 sm:py-5"
        style={{ background: 'var(--color-surface)', border: `1px solid ${accentColor}30`, boxShadow: `0 4px 20px ${accentColor}15` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: accentBg }}
            >
              <Timer className="h-5 w-5" style={{ color: accentColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Son teslim tarihi
              </p>
              <p className="text-[13px] font-semibold truncate" title={training.title}>
                {training.title}
              </p>
            </div>
          </div>

          {/* Countdown digits */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {days > 0 && (
              <>
                <div className="text-center">
                  <div className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-[16px] sm:text-[20px] font-bold font-mono" style={{ background: accentBg, color: accentColor }}>
                    {pad(days)}
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-muted)' }}>gün</p>
                </div>
                <span className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>:</span>
              </>
            )}
            <div className="text-center">
              <div className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-[16px] sm:text-[20px] font-bold font-mono" style={{ background: accentBg, color: accentColor }}>
                {pad(hours)}
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-muted)' }}>saat</p>
            </div>
            <span className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>:</span>
            <div className="text-center">
              <div className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-[16px] sm:text-[20px] font-bold font-mono" style={{ background: accentBg, color: accentColor }}>
                {pad(minutes)}
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-muted)' }}>dk</p>
            </div>
            <span className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>:</span>
            <div className="text-center">
              <div className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-[16px] sm:text-[20px] font-bold font-mono transition-colors duration-500" style={{ background: accentBg, color: accentColor }}>
                {pad(seconds)}
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-muted)' }}>sn</p>
            </div>
          </div>
        </div>
      </div>
    </BlurFade>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFetch<DashboardData>('/api/staff/dashboard');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const stats = [
    { title: 'Atanan Eğitim', value: data?.stats?.assigned ?? 0, icon: BookOpen, accentColor: 'var(--color-info)' },
    { title: 'Devam Eden', value: data?.stats?.inProgress ?? 0, icon: Clock, accentColor: 'var(--color-warning)' },
    { title: 'Tamamlanan', value: data?.stats?.completed ?? 0, icon: CheckCircle, accentColor: 'var(--color-success)' },
    { title: 'Başarısız', value: data?.stats?.failed ?? 0, icon: XCircle, accentColor: 'var(--color-error)' },
  ];

  const upcomingTrainings = data?.upcomingTrainings ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const notifications = data?.notifications ?? [];
  const overallProgress = data?.stats?.overallProgress ?? 0;
  const urgentTraining = data?.urgentTraining;

  return (
    <div className="space-y-6">
      {/* Greeting Banner */}
      <BlurFade delay={0}>
        <div
          className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #0f4a35 60%, #071f18 100%)',
            boxShadow: '0 8px 30px rgba(13, 150, 104, 0.2)',
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(209, 250, 229, 0.7)' }}>
                {new Date().getHours() < 12 ? 'Günaydın' : new Date().getHours() < 18 ? 'İyi günler' : 'İyi akşamlar'}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Hoş geldin, {user?.firstName ?? 'Kullanıcı'}
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Güncel eğitim ve sınav durumuna genel bakış
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>%{overallProgress}</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Genel İlerleme</p>
              </div>
              <div className="h-12 w-12 relative">
                <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray="97.4" strokeDashoffset={97.4 - (97.4 * overallProgress / 100)} strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Urgent Alert */}
      {urgentTraining && (
        <BlurFade delay={0.05}>
          <div
            className="relative overflow-hidden flex items-center gap-4 rounded-2xl px-6 py-4"
            style={{ background: 'linear-gradient(135deg, var(--color-error), #991b1b)', boxShadow: '0 4px 20px rgba(220, 38, 38, 0.2)' }}
          >
            <BorderBeam size={100} duration={6} colorFrom="#fca5a5" colorTo="#f59e0b" />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{urgentTraining.title} bitiş tarihi {urgentTraining.daysLeft} gün sonra!</p>
              <p className="text-xs text-white/60">Eğitimi tamamlamanız gerekmektedir.</p>
            </div>
            <Link
              href={`/staff/my-trainings/${urgentTraining.id}`}
              className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Play className="h-4 w-4" /> Devam Et
            </Link>
          </div>
        </BlurFade>
      )}

      {/* Countdown Widget — show for the nearest upcoming training with a real deadline */}
      {upcomingTrainings.length > 0 && upcomingTrainings[0].endDateTime && upcomingTrainings[0].daysLeft <= 14 && (
        <CountdownWidget training={upcomingTrainings[0]} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <BlurFade key={s.title} delay={0.1 + i * 0.05}>
            <StatCard {...s} />
          </BlurFade>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Trainings */}
        <BlurFade delay={0.3} className="lg:col-span-2">
          <div className="rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                    <Calendar className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Yaklaşan Eğitimler</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{upcomingTrainings.length} eğitim bekliyor</p>
                  </div>
                </div>
                <Link href="/staff/my-trainings" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)' }}>
                  Tümünü Gör <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {upcomingTrainings.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
                )}
                {upcomingTrainings.map((t) => {
                  const st = statusMap[t.status] || statusMap.assigned;
                  return (
                    <Link
                      key={t.id}
                      href={`/staff/my-trainings/${t.id}`}
                      className="flex items-center gap-4 rounded-xl p-3.5 transition-[transform,opacity,background-color] duration-200 group"
                      style={{ border: '1px solid var(--color-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ background: (t.daysLeft ?? 99) <= 3 ? 'var(--color-error-bg)' : 'var(--color-bg)' }}>
                        <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{t.deadline?.split('.')?.[1] === '03' ? 'MAR' : 'NİS'}</span>
                        <span className="text-base font-bold leading-none font-mono" style={{ color: (t.daysLeft ?? 99) <= 3 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>{t.deadline?.split('.')?.[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{t.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--color-border)' }}>
                            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${t.progress ?? 0}%`, background: st.text }} />
                          </div>
                          <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--color-text-muted)' }}>{t.progress ?? 0}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: st.bg, color: st.text }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.text }} />
                          {st.label}
                        </span>
                        {(t.daysLeft ?? 99) <= 7 && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: (t.daysLeft ?? 99) <= 3 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: (t.daysLeft ?? 99) <= 3 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                            {t.daysLeft} gün
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Right column */}
        <div className="space-y-6">
          {/* Notifications */}
          <BlurFade delay={0.35}>
            <div className="rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
                      <Bell className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <h3 className="text-sm font-bold">Bildirimler</h3>
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--color-error)' }}>
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {notifications.length === 0 && (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
                  )}
                  {notifications.map((n, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-150" style={{ background: !n.isRead ? 'var(--color-primary-light)' : 'transparent' }}>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full animate-pulse" style={{ background: 'var(--color-primary)' }} />}
                      <div className={!n.isRead ? '' : 'ml-4'}>
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/staff/notifications" className="mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors duration-150 hover:bg-(--color-surface-hover)" style={{ color: 'var(--color-primary)' }}>
                  Tümünü Gör <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </BlurFade>

          {/* Recent Activity */}
          <BlurFade delay={0.4}>
            <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="mb-4 text-sm font-bold">Son Aktivitelerim</h3>
              <div className="space-y-3.5">
                {recentActivity.length === 0 && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
                )}
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${typeColors[a.type] ?? 'var(--color-info)'}15` }}>
                      <div className="h-2 w-2 rounded-full" style={{ background: typeColors[a.type] ?? 'var(--color-info)' }} />
                    </div>
                    <div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{a.text}</p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
