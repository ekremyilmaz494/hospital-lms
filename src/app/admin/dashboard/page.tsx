'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users, GraduationCap, TrendingUp, AlertTriangle, Trophy, Activity, Clock,
  Plus, Send, Download, Building2, UserPlus, ShieldCheck,
  Radio, BookOpen, RefreshCw, ChevronRight, Medal, Crown,
  CheckCircle2, XCircle, Info, AlertCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
import { KStatCard } from '@/components/admin/k-stat-card';
import { KChartCard } from '@/components/admin/k-chart-card';
import { KQuickAction } from '@/components/admin/k-quick-action';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/shared/toast';
import { StatCardSkeleton, ListSkeleton, SectionError, ChartSkeleton } from '@/components/shared/skeletons';
import { RiskCenter } from './risk-center';

// Küçük UI bileşenleri — static import (< 5KB)
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

const MatrixMiniWidget = dynamic(() => import('./matrix-mini-widget').then(m => ({ default: m.MatrixMiniWidget })), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }} />,
});

function ChartSkeletonInline() {
  return <div className="h-64 animate-pulse" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14 }} />;
}

// ── Type definitions for split endpoints ──

interface StatsData {
  stats: { title: string; value: number | string; icon: string; accentColor: string; trend?: { value: number; label: string; isPositive: boolean; suffix?: string } }[];
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

const typeColors: Record<string, string> = { success: K.PRIMARY, error: '#b91c1c', info: '#1d4ed8', warning: '#b45309' };

const activityTypeStyle: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; ring: string }> = {
  success: { icon: CheckCircle2, color: '#047857', bg: 'rgba(16, 185, 129, 0.14)', ring: 'rgba(16, 185, 129, 0.30)' },
  error:   { icon: XCircle,      color: '#b91c1c', bg: 'rgba(239, 68, 68, 0.14)',  ring: 'rgba(239, 68, 68, 0.30)' },
  warning: { icon: AlertCircle,  color: '#b45309', bg: 'rgba(245, 158, 11, 0.16)', ring: 'rgba(245, 158, 11, 0.32)' },
  info:    { icon: Info,         color: '#1d4ed8', bg: 'rgba(59, 130, 246, 0.14)', ring: 'rgba(59, 130, 246, 0.30)' },
};

const medalTokens: { bg: string; ring: string; icon: typeof Crown; iconColor: string; label: string }[] = [
  { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', ring: 'rgba(245, 158, 11, 0.45)', icon: Crown,  iconColor: '#7c2d12', label: 'Şampiyon' },
  { bg: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)', ring: 'rgba(156, 163, 175, 0.45)', icon: Medal,  iconColor: '#374151', label: 'İkinci'    },
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', ring: 'rgba(180, 83, 9, 0.45)',   icon: Medal,  iconColor: '#451a03', label: 'Üçüncü'    },
];

const examStatusLabel: Record<string, { label: string; color: string; bg: string }> = {
  pre_exam: { label: 'Ön sınav', color: '#1d4ed8', bg: K.INFO_BG },
  watching_videos: { label: 'Video izliyor', color: '#b45309', bg: K.WARNING_BG },
  post_exam: { label: 'Sınav', color: K.ACCENT, bg: K.WARNING_BG },
};

function elapsedLabel(startedAt: string): string {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  return `${Math.floor(mins / 60)} sa önce`;
}

/** G7.6 — Kompakt tetikleyici kart; detay modal içinde açılır */
function LiveExamsCard() {
  const { attempts, isLoading, activeCount, isConnected, refetch } = useRealtimeExams();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: fallbackData } = useFetch<{ attempts: LiveExamAttempt[] }>(
    !isConnected && !isLoading ? '/api/admin/in-progress-exams' : null
  );
  const displayExams = isConnected ? attempts : (fallbackData?.attempts ?? attempts);
  const displayCount = isConnected ? activeCount : displayExams.filter(a => ['pre_exam', 'watching_videos', 'post_exam'].includes(a.status)).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    const start = Date.now();
    await refetch();
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 800 - elapsed);
    setTimeout(() => setRefreshing(false), remaining);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
        style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
      >
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: K.PRIMARY_LIGHT }}>
          <Radio className="h-4.5 w-4.5" style={{ color: K.PRIMARY }} />
          {displayCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2"
              style={{
                background: K.SUCCESS,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: K.TEXT_PRIMARY }}>Anlık Sınavlar</p>
          <p className="text-[11px] leading-tight truncate" style={{ color: K.TEXT_MUTED }}>
            {isLoading ? 'Yükleniyor…' : `${displayCount} aktif · ${isConnected ? 'Canlı' : 'Çevrimdışı'}`}
          </p>
        </div>
        <span
          className="inline-flex min-w-5.5 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{
            background: displayCount > 0 ? K.SUCCESS_BG : K.BG,
            color: displayCount > 0 ? K.PRIMARY : K.TEXT_MUTED,
          }}
        >
          {isLoading ? '…' : displayCount}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: K.TEXT_MUTED }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
                <Radio className="h-4.5 w-4.5" style={{ color: K.PRIMARY }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>Anlık Sınavlar</DialogTitle>
                <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>Şu an sınav yapan personel</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-60"
                title="Yenile"
                style={{ background: refreshing ? K.PRIMARY_LIGHT : 'transparent' }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: refreshing ? K.PRIMARY : K.TEXT_MUTED }} />
              </button>
              <div className="flex items-center gap-1.5 rounded-full" style={{ padding: '3px 8px', background: isConnected ? K.SUCCESS_BG : K.WARNING_BG }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: isConnected ? K.SUCCESS : K.WARNING, animation: isConnected ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: isConnected ? K.PRIMARY : '#b45309' }}>
                  {isConnected ? 'Canlı' : 'Çevrimdışı'}
                </span>
              </div>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: K.BG }} />
                ))}
              </div>
            ) : displayExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ background: K.BG }}>
                  <BookOpen className="h-6 w-6" style={{ color: K.TEXT_MUTED }} />
                </div>
                <p className="text-[13px]" style={{ color: K.TEXT_MUTED }}>Şu an aktif sınav yok</p>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {displayExams.map((attempt: LiveExamAttempt) => {
                  const st = examStatusLabel[attempt.status] ?? examStatusLabel.pre_exam;
                  return (
                    <div
                      key={attempt.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                      style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 14 }}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: K.PRIMARY }}
                      >
                        {attempt.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13px] font-semibold" style={{ color: K.TEXT_PRIMARY }}>{attempt.user.name}</p>
                        <p className="truncate text-[11px]" style={{ color: K.TEXT_MUTED }}>
                          {attempt.training.title.length > 32 ? attempt.training.title.slice(0, 32) + '…' : attempt.training.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className="inline-flex items-center rounded-full"
                          style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: K.TEXT_MUTED }}>
                          {elapsedLabel(attempt.startedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const quickActions = [
  { label: 'Yeni Eğitim', desc: 'Video tabanlı eğitim oluştur', icon: Plus, href: '/admin/trainings/new', color: K.PRIMARY, gradient: K.PRIMARY, glowColor: K.PRIMARY_LIGHT },
  { label: 'Personel Ekle', desc: 'Yeni personel kaydı', icon: UserPlus, href: '/admin/staff', color: K.INFO, gradient: K.INFO, glowColor: K.INFO_BG },
  { label: 'Hatırlatma Gönder', desc: 'Toplu bildirim gönder', icon: Send, href: '/admin/notifications', color: K.ACCENT, gradient: K.ACCENT, glowColor: K.WARNING_BG },
  { label: 'Rapor İndir', desc: 'Excel ve PDF raporları', icon: Download, href: '/admin/reports', color: K.SUCCESS, gradient: K.SUCCESS, glowColor: K.SUCCESS_BG },
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

  // Mount'ta arka planda bir kez taze çekim — başka sayfadan dönerken (örn. eğitim
  // oluşturma sonrası) Redis cache server tarafında invalidateDashboardCache ile
  // temizlenmiş olur, useFetch'in client cache'i ise STALE_TIME süresince eski
  // veriyi gösterir. Bu refetch o boşluğu kapatır.
  useEffect(() => {
    dashRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uyumluluk katmanı — mevcut render kodunu bozmamak için, ancak referential
  // stability için useMemo ile sarıldı (child component'lerde gereksiz re-render önler).
  const stats = useMemo(() => ({ data: dashboardData?.stats ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch }), [dashboardData?.stats, dashLoading, dashError, dashRefetch]);
  const charts = useMemo(() => ({ data: dashboardData?.charts ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch }), [dashboardData?.charts, dashLoading, dashError, dashRefetch]);
  const compliance = useMemo(() => ({ data: dashboardData?.compliance ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch }), [dashboardData?.compliance, dashLoading, dashError, dashRefetch]);
  const activity = useMemo(() => ({ data: dashboardData?.activity ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch }), [dashboardData?.activity, dashLoading, dashError, dashRefetch]);
  const certs = useMemo(() => ({ data: dashboardData?.certs ?? null, isLoading: dashLoading, error: dashError, refetch: dashRefetch }), [dashboardData?.certs, dashLoading, dashError, dashRefetch]);

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

  // ── Derived values from stats (memoize: 90sn polling'de gereksiz re-render önle) ──
  const statCards = useMemo(
    () => (stats.data?.stats ?? []).map(s => ({ ...s, icon: iconMap[s.icon] || Users })),
    [stats.data?.stats],
  );
  const complianceAlerts = stats.data?.complianceAlerts ?? [];
  // Referential stability: `?? []` her render'da yeni boş dizi yaratır;
  // useMemo ile sararak alt useMemo'ların gereksiz invalide olmasını önle.
  const statusDistribution = useMemo(
    () => stats.data?.statusDistribution ?? [],
    [stats.data?.statusDistribution],
  );
  const totalAssignments = useMemo(
    () => statusDistribution.reduce((s, d) => s + d.value, 0),
    [statusDistribution],
  );

  // ── Derived values from charts ──
  const trendData = useMemo(
    () => charts.data?.trendData ?? [],
    [charts.data?.trendData],
  );
  const departmentComparison = charts.data?.departmentComparison ?? [];
  const hasTrendData = useMemo(
    () => trendData.some(t => t.atanan > 0 || t.tamamlanan > 0 || t.basarisiz > 0),
    [trendData],
  );

  // ── Derived values from compliance ──
  const overdueTrainings = compliance.data?.overdueTrainings ?? [];

  // ── Derived values from activity ──
  const topPerformers = activity.data?.topPerformers ?? [];
  const recentActivity = activity.data?.recentActivity ?? [];

  // ── Derived values from certs ──
  const expiringCerts = certs.data?.expiringCerts ?? [];

  // Claude Design pattern: "Merhaba, [Ad]" + günün saatine göre selamlama
  const firstName = (user?.firstName || 'Yönetici').trim();
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'Merhaba' : 'İyi akşamlar';

  return (
    <div className="k-page">
      {/* ── Always renders immediately (no API dependency) ── */}
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span data-current="true">Panel</span>
            </div>
            <h1 className="k-page-title">
              {greeting}, <span style={{ color: K.PRIMARY }}>{firstName}</span>
            </h1>
            <p className="k-page-subtitle">
              Bu hafta {user?.department || 'hastanenizde'} eğitim ve uyum durumuna genel bir bakış.
            </p>
          </div>
        </header>
      </BlurFade>

      {/* Quick Actions */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((a) => (
            <KQuickAction
              key={a.label}
              href={a.href}
              label={a.label}
              desc={a.desc}
              icon={a.icon}
              color={a.color}
            />
          ))}
        </div>
      </BlurFade>

      {/* ── Stats Section (polling: 60s) — ilk ekran KPI'ları ── */}
      {stats.error ? (
        <SectionError message={stats.error} onRetry={stats.refetch} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {stats.isLoading
            ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((stat, i) => {
                // accentColor "var(--color-primary)" gibi geliyor — Klinova hex map
                const accent = stat.accentColor
                  ?.replace('var(--color-primary)', K.PRIMARY)
                  .replace('var(--color-success)', K.SUCCESS)
                  .replace('var(--color-info)', K.INFO)
                  .replace('var(--color-error)', K.ERROR)
                  .replace('var(--color-warning)', K.WARNING)
                  .replace('var(--color-accent)', K.ACCENT) ?? K.PRIMARY;
                return (
                  <BlurFade key={stat.title} delay={0.02 + i * 0.02}>
                    <KStatCard
                      title={stat.title}
                      value={stat.value}
                      icon={stat.icon}
                      accentColor={accent}
                      trend={stat.trend}
                    />
                  </BlurFade>
                );
              })}
        </div>
      )}

      {/* Anlık Sınavlar + Risk Merkezi — kompakt tetikleyici; modal'da açılır */}
      <BlurFade delay={0.02}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LiveExamsCard />
          <RiskCenter
            overdueTrainings={overdueTrainings}
            complianceAlerts={complianceAlerts}
            expiringCerts={expiringCerts}
            isLoading={compliance.isLoading || stats.isLoading || certs.isLoading}
            sendingReminder={sendingReminder}
            onSendReminder={handleSendReminder}
          />
        </div>
      </BlurFade>

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0} className="lg:col-span-2">
          {charts.error ? (
            <SectionError message={charts.error} onRetry={charts.refetch} />
          ) : charts.isLoading ? (
            <ChartSkeleton />
          ) : (
            <KChartCard title="Aylık Eğitim Trendi" icon={<TrendingUp size={15} />}>
              {hasTrendData ? (
                <div className="h-72">
                  <TrendChart data={trendData} />
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-sm" style={{ color: K.TEXT_MUTED }}>Henüz eğitim ataması yapılmamış. Personele eğitim atadıkça burada aylık trend görünecek.</div>
              )}
            </KChartCard>
          )}
        </BlurFade>

        {/* Status Donut */}
        <BlurFade delay={0}>
          {stats.isLoading ? (
            <ChartSkeleton />
          ) : (
            <KChartCard title="Eğitim Durum Dağılımı" className="h-full">
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
                          <span style={{ color: K.TEXT_SECONDARY }}>{s.name}</span>
                        </div>
                        <span className="font-mono font-semibold tabular-nums" style={{ color: K.TEXT_PRIMARY }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-44 flex items-center justify-center text-sm text-center px-4" style={{ color: K.TEXT_MUTED }}>Personele eğitim atandığında durum dağılımı burada görünecek</div>
              )}
            </KChartCard>
          )}
        </BlurFade>
      </div>

      {/* ── Department Comparison (full width) ── */}
      <BlurFade delay={0}>
        {charts.error ? (
          <SectionError message={charts.error} onRetry={charts.refetch} />
        ) : charts.isLoading ? (
          <ChartSkeleton />
        ) : (
          <KChartCard title="Departman Karşılaştırması" icon={<Building2 size={15} />}>
            {departmentComparison.length > 0 ? (
              <div style={{ minHeight: 256, maxHeight: 460, overflow: 'hidden' }} className="flex flex-col">
                <DepartmentBar data={departmentComparison} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-center px-4" style={{ color: K.TEXT_MUTED }}>Personele eğitim atandığında departman karşılaştırması burada görünecek</div>
            )}
          </KChartCard>
        )}
      </BlurFade>

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
            <MagicCard gradientColor="rgba(245, 158, 11, 0.05)" gradientOpacity={0.4} className="p-0" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0%, rgba(245, 158, 11, 0.22) 100%)' }}>
                      <Trophy className="h-4 w-4" style={{ color: '#b45309' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, letterSpacing: '-0.01em' }}>En Başarılı Personeller</h3>
                      <p className="text-[11px] font-medium" style={{ color: K.TEXT_MUTED, letterSpacing: '0.02em' }}>Bu dönem performans liderleri</p>
                    </div>
                  </div>
                  <Link href="/admin/staff" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-80" style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
                    Tümü <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {topPerformers.length > 0 ? (
                  <div className="space-y-1.5">
                    {topPerformers.map((p, idx) => {
                      const medal = idx < 3 ? medalTokens[idx] : null;
                      const scoreTier = p.score >= 95 ? { color: K.PRIMARY, bg: 'rgba(16, 185, 129, 0.10)' }
                        : p.score >= 80 ? { color: '#b45309', bg: 'rgba(245, 158, 11, 0.10)' }
                        : { color: K.TEXT_SECONDARY, bg: 'rgba(120, 113, 108, 0.10)' };
                      const isLeader = idx === 0;
                      return (
                        <div
                          key={p.name}
                          className="group relative grid items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                          style={{
                            gridTemplateColumns: 'auto auto minmax(0, 1fr) auto',
                            background: isLeader ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)' : 'transparent',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isLeader ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.02) 100%)' : 'rgba(15, 23, 42, 0.03)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isLeader ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)' : 'transparent'; }}
                        >
                          {/* Rank rozeti — top 3 madalya, sonrası numerik */}
                          {medal ? (
                            <div
                              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: medal.bg,
                                boxShadow: `0 0 0 2px ${K.SURFACE}, 0 0 0 4px ${medal.ring}, 0 2px 6px ${medal.ring}`,
                              }}
                              title={medal.label}
                            >
                              <medal.icon className="h-3.5 w-3.5" style={{ color: medal.iconColor }} strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: K.BG, border: `1.5px solid ${K.BORDER_LIGHT}`, color: K.TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                              {idx + 1}
                            </div>
                          )}

                          {/* Avatar — gradient */}
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback
                              className="text-xs font-bold text-white"
                              style={{
                                background: `linear-gradient(135deg, ${p.color} 0%, color-mix(in srgb, ${p.color} 70%, #000) 100%)`,
                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.10)',
                              }}
                            >
                              {p.initials}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight" style={{ color: K.TEXT_PRIMARY, letterSpacing: '-0.005em' }} title={p.name}>
                              {p.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] font-medium uppercase" style={{ color: K.TEXT_MUTED, letterSpacing: '0.04em' }}>
                              {p.department}
                            </p>
                          </div>

                          {/* Score kapsülü */}
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right leading-tight">
                              <div
                                className="inline-flex items-baseline gap-0.5 rounded-lg px-2 py-0.5 font-mono tabular-nums"
                                style={{ background: scoreTier.bg, color: scoreTier.color, fontSize: 14, fontWeight: 800 }}
                              >
                                <span style={{ fontSize: 10, opacity: 0.7 }}>%</span>{p.score}
                              </div>
                              <div className="mt-0.5 text-[10px] font-medium" style={{ color: K.TEXT_MUTED }}>
                                {p.courses} eğitim
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: K.BG, color: K.TEXT_MUTED, border: `1px dashed ${K.BORDER_LIGHT}` }}>
                    Personel sınavları tamamladıkça performans verileri burada görünecek.
                  </div>
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
            <MagicCard gradientColor="rgba(13, 150, 104, 0.04)" gradientOpacity={0.4} className="p-0" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(13, 150, 104, 0.14) 0%, rgba(13, 150, 104, 0.20) 100%)' }}>
                      <Activity className="h-4 w-4" style={{ color: K.PRIMARY }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, letterSpacing: '-0.01em' }}>Son Aktiviteler</h3>
                      <p className="text-[11px] font-medium" style={{ color: K.TEXT_MUTED, letterSpacing: '0.02em' }}>Canlı sistem olayları</p>
                    </div>
                  </div>
                  <Link href="/admin/audit-logs" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-80" style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
                    Tümü <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {recentActivity.length > 0 ? (
                  <div className="relative">
                    {/* Timeline rail */}
                    <span
                      aria-hidden
                      className="absolute left-[15px] top-3 bottom-3 w-px"
                      style={{ background: `linear-gradient(180deg, ${K.BORDER_LIGHT} 0%, ${K.BORDER_LIGHT} 80%, transparent 100%)` }}
                    />
                    <div className="space-y-3.5">
                      {recentActivity.map((item, idx) => {
                        const style = activityTypeStyle[item.type] ?? activityTypeStyle.info;
                        const Icon = style.icon;
                        return (
                          <div key={idx} className="group relative flex gap-3">
                            {/* Knot */}
                            <div
                              className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                              style={{
                                background: style.bg,
                                boxShadow: `0 0 0 2px ${K.SURFACE}, 0 0 0 4px ${style.ring}`,
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" style={{ color: style.color }} strokeWidth={2.5} />
                            </div>

                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm leading-snug" style={{ color: K.TEXT_PRIMARY }}>
                                <span className="font-semibold" style={{ color: K.TEXT_PRIMARY }}>{item.user}</span>
                                {' '}
                                <span style={{ color: K.TEXT_SECONDARY }}>{item.action}</span>
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, color: K.TEXT_MUTED }}
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  <span className="font-mono tabular-nums">{elapsedLabel(item.time)}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: K.BG, color: K.TEXT_MUTED, border: `1px dashed ${K.BORDER_LIGHT}` }}>
                    Sistem olayları gerçekleştikçe burada görünecek.
                  </div>
                )}
              </div>
            </MagicCard>
          )}
        </BlurFade>
      </div>
    </div>
  );
}
