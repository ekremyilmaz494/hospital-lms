'use client';

import { useState } from 'react';
import {
  Users, GraduationCap, TrendingUp, AlertTriangle, Trophy, Activity, Clock, ArrowRight,
  Plus, Send, Download, Shield, Building2, CalendarClock, UserPlus, ShieldCheck,
  Radio, BookOpen, RefreshCw,
} from 'lucide-react';
import { useRealtimeExams } from '@/hooks/use-realtime-exams';
import type { LiveExamAttempt } from '@/hooks/use-realtime-exams';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Chart'lar aynı modülden — tek shared import ile webpack dedup
const chartImport = () => import('@/components/shared/charts/admin-dashboard-charts')
const TrendChart = dynamic(() => chartImport().then(m => ({ default: m.TrendChart })), { ssr: false, loading: () => <ChartSkeletonInline /> })
const StatusDonut = dynamic(() => chartImport().then(m => ({ default: m.StatusDonut })), { ssr: false, loading: () => <ChartSkeletonInline /> })
const DepartmentBar = dynamic(() => chartImport().then(m => ({ default: m.DepartmentBar })), { ssr: false, loading: () => <ChartSkeletonInline /> })
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/shared/toast';
import { StatCardSkeleton, TableSkeleton, ListSkeleton, AlertSkeleton, SectionError, ChartSkeleton } from '@/components/shared/skeletons';

// Küçük UI bileşenleri — static import (< 5KB)
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { BorderBeam } from '@/components/ui/border-beam';
const MatrixMiniWidget = dynamic(() => import('./matrix-mini-widget').then(m => ({ default: m.MatrixMiniWidget })), {
  ssr: false,
  loading: () => <div className="animate-pulse rounded-2xl border h-64" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />,
});

function ChartSkeletonInline() {
  return <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface)' }} />;
}

// ── Type definitions for split endpoints ──

interface StatsData {
  stats: { title: string; value: number | string; icon: string; accentColor: string; trend?: { value: number; label: string; isPositive: boolean } }[];
  complianceAlerts: { training: string; regulatoryBody: string; daysLeft: number; complianceRate: number; status: string }[];
  statusDistribution: { name: string; value: number; color: string }[];
}

interface ChartsData {
  trendData: { month: string; tamamlanan: number; atanan: number; basarisiz: number }[];
  departmentComparison: { dept: string; oran: number; puan: number }[];
}

interface ComplianceData {
  overdueTrainings: { assignmentId: string; trainingId: string; name: string; dept: string; training: string; dueDate: string; daysOverdue: number; color: string }[];
}

interface ActivityData {
  topPerformers: { name: string; department: string; score: number; courses: number; initials: string; color: string }[];
  recentActivity: { action: string; user: string; time: string; type: string }[];
}

interface CertsData {
  expiringCerts: { name: string; cert: string; expiryDate: string; daysLeft: number; status: string }[];
}

const iconMap: Record<string, typeof Users> = { Users, GraduationCap, TrendingUp, AlertTriangle, ShieldCheck };

const typeColors: Record<string, string> = { success: 'var(--color-success)', error: 'var(--color-error)', info: 'var(--color-info)', warning: 'var(--color-warning)' };

const examStatusLabel: Record<string, { label: string; color: string; bg: string }> = {
  pre_exam: { label: 'Ön sınav', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  watching_videos: { label: 'Video izliyor', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  post_exam: { label: 'Sınav', color: 'var(--color-accent)', bg: 'var(--color-warning-bg)' },
};

function elapsedLabel(startedAt: string): string {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  return `${Math.floor(mins / 60)} sa önce`;
}

/** G7.6 — Realtime in-progress exam list for admin dashboard */
function LiveExamsWidget() {
  const { attempts, isLoading, activeCount, isConnected, refetch } = useRealtimeExams();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const start = Date.now();
    await refetch();
    // Minimum 800ms spin so the user clearly sees the refresh happened
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 800 - elapsed);
    setTimeout(() => setRefreshing(false), remaining);
  };

  const { data: fallbackData } = useFetch<{ attempts: LiveExamAttempt[] }>(
    !isConnected && !isLoading ? '/api/admin/in-progress-exams' : null
  );
  const displayExams = isConnected ? attempts : (fallbackData?.attempts ?? attempts);
  const displayCount = isConnected ? activeCount : displayExams.filter(a => ['pre_exam', 'watching_videos', 'post_exam'].includes(a.status)).length;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
            <Radio className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
            {displayCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-success)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Anlık Sınavlar</h3>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Şu an sınav yapan personel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
            title="Yenile"
            style={{
              background: refreshing ? 'var(--color-primary-light)' : 'transparent',
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              style={{
                color: refreshing ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            />
          </button>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: isConnected ? 'var(--color-success-bg)' : 'var(--color-warning-bg)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: isConnected ? 'var(--color-success)' : 'var(--color-warning)', animation: isConnected ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none' }} />
            <span className="text-[10px] font-semibold" style={{ color: isConnected ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {isConnected ? 'Canlı' : 'Önbellek'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: displayCount > 0 ? 'var(--color-success-bg)' : 'var(--color-bg)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: displayCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
            <span className="text-[12px] font-semibold" style={{ color: displayCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              {isLoading ? '...' : `${displayCount} aktif`}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--color-bg)' }} />
          ))}
        </div>
      ) : displayExams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ background: 'var(--color-bg)' }}>
            <BookOpen className="h-6 w-6" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Şu an aktif sınav yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayExams.slice(0, 8).map((attempt: LiveExamAttempt) => {
            const st = examStatusLabel[attempt.status] ?? examStatusLabel.pre_exam;
            return (
              <div
                key={attempt.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {attempt.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold">{attempt.user.name}</p>
                  <p className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {attempt.training.title.length > 32 ? attempt.training.title.slice(0, 32) + '…' : attempt.training.title}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {elapsedLabel(attempt.startedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const quickActions = [
  { label: 'Yeni Eğitim', desc: 'Video tabanlı eğitim oluştur', icon: Plus, href: '/admin/trainings/new', color: 'var(--color-primary)', gradient: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-600) calc(0.08 * 100%), transparent) 0%, color-mix(in srgb, var(--brand-600) calc(0.02 * 100%), transparent) 100%)', glowColor: 'color-mix(in srgb, var(--brand-600) calc(0.06 * 100%), transparent)' },
  { label: 'Personel Ekle', desc: 'Yeni personel kaydı', icon: UserPlus, href: '/admin/staff', color: 'var(--color-info)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)', glowColor: 'rgba(59,130,246,0.06)' },
  { label: 'Hatırlatma Gönder', desc: 'Toplu bildirim gönder', icon: Send, href: '/admin/notifications', color: 'var(--color-accent)', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)', glowColor: 'rgba(245,158,11,0.06)' },
  { label: 'Rapor İndir', desc: 'Excel ve PDF raporları', icon: Download, href: '/admin/reports', color: 'var(--color-success)', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)', glowColor: 'rgba(34,197,94,0.06)' },
];


export default function AdminDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // ── Combined dashboard data — tek HTTP istek, 90s polling ──
  interface DashboardCombinedData {
    stats: StatsData | null;
    charts: ChartsData | null;
    compliance: ComplianceData | null;
    activity: ActivityData | null;
    certs: CertsData | null;
  }
  const { data: dashboardData, isLoading: dashLoading, error: dashError, refetch: dashRefetch } =
    useFetch<DashboardCombinedData>('/api/admin/dashboard/combined', { interval: 90_000 });

  // Uyumluluk katmanı — mevcut render kodunu bozmamak için
  const stats = { data: dashboardData?.stats ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch };
  const charts = { data: dashboardData?.charts ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch };
  const compliance = { data: dashboardData?.compliance ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch };
  const activity = { data: dashboardData?.activity ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch };
  const certs = { data: dashboardData?.certs ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch };

  const handleSendReminder = async (assignmentId: string, staffName: string) => {
    setSendingReminder(assignmentId);
    try {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentIds: [assignmentId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${staffName} için email ve bildirim gönderildi`, 'success');
    } catch {
      toast('Hatırlatma gönderilemedi', 'error');
    } finally {
      setSendingReminder(null);
    }
  };

  // ── Derived values from stats ──
  const statCards = (stats.data?.stats ?? []).map(s => ({ ...s, icon: iconMap[s.icon] || Users }));
  const complianceAlerts = stats.data?.complianceAlerts ?? [];
  const statusDistribution = stats.data?.statusDistribution ?? [];
  const totalAssignments = statusDistribution.reduce((s, d) => s + d.value, 0);

  // ── Derived values from charts ──
  const trendData = charts.data?.trendData ?? [];
  const departmentComparison = charts.data?.departmentComparison ?? [];
  const hasTrendData = trendData.some(t => t.atanan > 0 || t.tamamlanan > 0 || t.basarisiz > 0);

  // ── Derived values from compliance ──
  const overdueTrainings = compliance.data?.overdueTrainings ?? [];

  // ── Derived values from activity ──
  const topPerformers = activity.data?.topPerformers ?? [];
  const recentActivity = activity.data?.recentActivity ?? [];

  // ── Derived values from certs ──
  const expiringCerts = certs.data?.expiringCerts ?? [];

  return (
    <div className="space-y-6">
      {/* ── Always renders immediately (no API dependency) ── */}
      <BlurFade delay={0}>
        <PageHeader title="Dashboard" subtitle={`${user?.department || 'Hastane'} genel durumu`} />
      </BlurFade>

      {/* Quick Actions */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:duration-75"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-[transform] duration-200 group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${a.color} 12%, transparent)` }}
              >
                <a.icon className="h-[18px] w-[18px]" style={{ color: a.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight">{a.label}</p>
                <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--color-text-muted)' }}>{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </BlurFade>

      {/* G7.6 — Live In-Progress Exams (Supabase Realtime — always independent) */}
      <BlurFade delay={0.02}>
        <LiveExamsWidget />
      </BlurFade>

      {/* ── Stats Section (polling: 60s) ── */}
      {stats.error ? (
        <SectionError message={stats.error} onRetry={stats.refetch} />
      ) : (
        <>
          {/* Warning Banner — depends on compliance + certs */}
          {!compliance.isLoading && !certs.isLoading && (overdueTrainings.length > 0 || expiringCerts.filter(c => c.daysLeft <= 7).length > 0) && (
            <BlurFade delay={0.02}>
              <div className="relative overflow-hidden flex items-center gap-4 rounded-2xl px-6 py-4" style={{ background: 'linear-gradient(135deg, var(--color-accent), #92400e)', boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)' }}>
                <BorderBeam size={100} duration={8} colorFrom="#fbbf24" colorTo="#f59e0b" />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{overdueTrainings.length} personelin eğitimi gecikmiş, {expiringCerts.filter(c => c.daysLeft <= 7).length} sertifika süresi dolmak üzere!</p>
                  <p className="text-xs text-white/60">Acil müdahale gerekiyor.</p>
                </div>
                <Link href="/admin/reports" className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  Detayları Gör <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </BlurFade>
          )}

          {/* Compliance Alerts */}
          {stats.isLoading ? (
            <AlertSkeleton />
          ) : complianceAlerts.length > 0 ? (
            <BlurFade delay={0.02}>
              <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-error-bg)' }}>
                      <Shield className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Uyum Alarmları</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Zorunlu eğitim deadline yaklaşıyor</p>
                    </div>
                  </div>
                  <Link href="/admin/compliance" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                    Tümünü Gör →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {complianceAlerts.map((alert, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{
                      background: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error-bg)' : 'var(--color-warning-bg, #fffbeb)',
                      border: `1px solid ${alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)'}30`,
                    }}>
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{alert.training}</p>
                        {alert.regulatoryBody && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{alert.regulatoryBody}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold" style={{ color: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }}>
                            {alert.status === 'overdue' ? 'Süre Doldu!' : `${alert.daysLeft} gün`}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>· %{alert.complianceRate} uyumlu</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>
          ) : null}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
              : statCards.map((stat, i) => (
                  <BlurFade key={stat.title} delay={0.02 + i * 0.02}><StatCard {...stat} /></BlurFade>
                ))
            }
          </div>
        </>
      )}

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0} className="lg:col-span-2">
          {charts.error ? (
            <SectionError message={charts.error} onRetry={charts.refetch} />
          ) : charts.isLoading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard title="Aylık Eğitim Trendi" icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
              {hasTrendData ? (
                <div className="h-72">
                  <TrendChart data={trendData} />
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz eğitim ataması yapılmamış. Personele eğitim atadıkça burada aylık trend görünecek.</div>
              )}
            </ChartCard>
          )}
        </BlurFade>

        {/* Status Donut — data from stats endpoint */}
        <BlurFade delay={0}>
          {stats.isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="rounded-2xl border p-6 h-full" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="text-sm font-bold mb-4">Eğitim Durum Dağılımı</h3>
              {totalAssignments > 0 ? (
                <>
                  <div className="h-44">
                    <StatusDonut data={statusDistribution} total={totalAssignments} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {statusDistribution.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          <span style={{ color: 'var(--color-text-secondary)' }}>{s.name}</span>
                        </div>
                        <span className="font-mono font-semibold">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-44 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--color-text-muted)' }}>Personele eğitim atandığında durum dağılımı burada görünecek</div>
              )}
            </div>
          )}
        </BlurFade>
      </div>

      {/* ── Department Comparison + Certificate Expiry ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Comparison — from charts endpoint */}
        <BlurFade delay={0}>
          {charts.error ? (
            <SectionError message={charts.error} onRetry={charts.refetch} />
          ) : charts.isLoading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard title="Departman Karşılaştırması" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
              {departmentComparison.length > 0 ? (
                <div className="h-64">
                  <DepartmentBar data={departmentComparison} />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--color-text-muted)' }}>Personele eğitim atandığında departman karşılaştırması burada görünecek</div>
              )}
            </ChartCard>
          )}
        </BlurFade>

        {/* Certificate Expiry Tracker — from certs endpoint */}
        <BlurFade delay={0}>
          {certs.error ? (
            <SectionError message={certs.error} onRetry={certs.refetch} />
          ) : certs.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (
            <MagicCard gradientColor="rgba(220, 38, 38, 0.04)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-error-bg)' }}>
                      <Shield className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Sertifika Süreleri</h3>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Yaklaşan sertifika yenilemeleri</p>
                    </div>
                  </div>
                </div>
                {expiringCerts.length > 0 ? (
                  <div className="space-y-3">
                    {expiringCerts.map((c) => (
                      <div key={c.name} className="flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-(--color-surface-hover)" style={{ border: '1px solid var(--color-border)' }}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: c.status === 'critical' ? 'var(--color-error-bg)' : c.status === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)' }}>
                          <CalendarClock className="h-5 w-5" style={{ color: c.status === 'critical' ? 'var(--color-error)' : c.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{c.name}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{c.cert}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{c.expiryDate}</p>
                          <p className="text-xs font-bold" style={{ color: c.status === 'critical' ? 'var(--color-error)' : c.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            {c.daysLeft} gün
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Eğitim atamaları yapıldıkça veriler burada görünecek.</div>
                )}
              </div>
            </MagicCard>
          )}
        </BlurFade>
      </div>

      {/* ── Overdue Table — from compliance endpoint (polling: 120s) ── */}
      {compliance.error ? (
        <SectionError message={compliance.error} onRetry={compliance.refetch} />
      ) : compliance.isLoading ? (
        <TableSkeleton rows={3} />
      ) : overdueTrainings.length > 0 ? (
        <BlurFade delay={0}>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-error-bg)' }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Geciken Eğitimler</h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{overdueTrainings.length} personel eğitim süresini aşmış</p>
                </div>
              </div>
              <Link href="/admin/reports" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Tümünü Gör
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Departman</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Tarih</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Gecikme</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {overdueTrainings.map((t, i) => (
                  <tr key={i} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>{t.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                        <span className="font-semibold">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5" style={{ color: 'var(--color-text-secondary)' }}>{t.dept}</td>
                    <td className="px-4 py-3.5">{t.training}</td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.dueDate}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                        {t.daysOverdue} gün gecikmiş
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-lg text-xs"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                        disabled={sendingReminder === t.assignmentId}
                        onClick={() => handleSendReminder(t.assignmentId, t.name)}
                      >
                        <Send className="h-3 w-3" />
                        {sendingReminder === t.assignmentId ? 'Gönderiliyor...' : 'Hatırlat'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlurFade>
      ) : null}

      {/* Competency Matrix Widget */}
      <BlurFade delay={0}>
        <MatrixMiniWidget />
      </BlurFade>

      {/* ── Activity Section (polling: 90s) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <BlurFade delay={0}>
          {activity.error ? (
            <SectionError message={activity.error} onRetry={activity.refetch} />
          ) : activity.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <MagicCard gradientColor="rgba(245, 158, 11, 0.04)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
                      <Trophy className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <h3 className="text-sm font-bold">En Başarılı Personeller</h3>
                  </div>
                  <Link href="/admin/staff" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Tümü</Link>
                </div>
                {topPerformers.length > 0 ? (
                  <div className="space-y-2">
                    {topPerformers.map((p, idx) => (
                      <div key={p.name} className="clickable-row flex items-center gap-3 rounded-xl px-3 py-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: idx < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{idx + 1}</div>
                        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: p.color }}>{p.initials}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono" style={{ color: p.score >= 95 ? 'var(--color-success)' : 'var(--color-text-primary)' }}>{p.score}%</p>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{p.courses} eğitim</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Personel sınavları tamamladıkça performans verileri görünecek.</div>
                )}
              </div>
            </MagicCard>
          )}
        </BlurFade>

        {/* Recent Activity */}
        <BlurFade delay={0}>
          {activity.error ? (
            <SectionError message={activity.error} onRetry={activity.refetch} />
          ) : activity.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <MagicCard gradientColor="color-mix(in srgb, var(--brand-600) calc(0.04 * 100%), transparent)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                      <Activity className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <h3 className="text-sm font-bold">Son Aktiviteler</h3>
                  </div>
                  <Link href="/admin/audit-logs" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Tümü</Link>
                </div>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${typeColors[item.type] ?? 'var(--color-info)'}15` }}>
                          <div className="h-2 w-2 rounded-full" style={{ background: typeColors[item.type] ?? 'var(--color-info)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm"><span className="font-semibold">{item.user}</span> <span style={{ color: 'var(--color-text-secondary)' }}>{item.action}</span></p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                            <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{item.time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sertifika süreleri yaklaştıkça hatırlatmalar burada görünecek.</div>
                )}
              </div>
            </MagicCard>
          )}
        </BlurFade>
      </div>
    </div>
  );
}
