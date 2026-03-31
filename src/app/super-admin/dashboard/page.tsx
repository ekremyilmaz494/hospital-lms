'use client';

import {
  Building2, CreditCard, Users, GraduationCap, TrendingUp, AlertTriangle,
  ArrowRight, ExternalLink, Clock, Calendar, Activity, Shield, Plus,
  BarChart3, Globe, Server, Radio,
} from 'lucide-react';
import { useActiveUsersCount } from '@/hooks/use-active-users-count';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';

import { BorderBeam } from '@/components/ui/border-beam';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

import type { LucideIcon } from 'lucide-react';

interface DashboardStat {
  title: string;
  value: number | string;
  icon: string;
  accentColor: string;
  trend?: { value: number; label: string; isPositive: boolean };
}

interface RecentHospital {
  id: string;
  name: string;
  code: string;
  registeredAt: string;
  staffCount: number;
  trainingCount: number;
  plan: string;
}

interface ExpiringSubscription {
  id: string;
  name: string;
  code: string;
  plan: string;
  expiresAt: string;
  daysLeft: number;
  status: string;
}

interface RecentActivity {
  action: string;
  entityType: string;
  user: string;
  role: string;
  time: string;
  type: string;
}

interface PlatformOverview {
  hospitalCount: number;
  activeHospitalCount: number;
  suspendedCount: number;
  totalUsers: number;
  totalStaff: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  completionRate: number;
}

interface DashboardData {
  stats: DashboardStat[];
  alert?: { message: string; actionLabel: string; actionHref: string; variant: string };
  monthlyData: { month: string; hastane: number; personel: number }[];
  subscriptionData: { plan: string; aktif: number; trial: number; suresiDoldu: number }[];
  recentHospitals: RecentHospital[];
  expiringSubscriptions: ExpiringSubscription[];
  recentActivity: RecentActivity[];
  platformOverview: PlatformOverview;
}

const iconMap: Record<string, LucideIcon> = { Building2, CreditCard, Users, GraduationCap, TrendingUp, AlertTriangle };

const quickActions = [
  { label: 'Yeni Hastane', icon: Plus, href: '/super-admin/hospitals/new', color: 'var(--color-primary)' },
  { label: 'Abonelikler', icon: CreditCard, href: '/super-admin/subscriptions', color: 'var(--color-accent)' },
  { label: 'Raporlar', icon: BarChart3, href: '/super-admin/reports', color: 'var(--color-info)' },
  { label: 'Denetim Kayıtları', icon: Shield, href: '/super-admin/audit-logs', color: 'var(--color-success)' },
];

const planColors: Record<string, string> = {
  'Başlangıç': 'var(--color-info)',
  'Profesyonel': 'var(--color-accent)',
  'Kurumsal': 'var(--color-primary)',
};

const statusUrgency: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
};

const typeColors: Record<string, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
};

const actionLabels: Record<string, string> = {
  'create': 'Oluşturdu',
  'update': 'Güncelledi',
  'delete': 'Sildi',
  'assign': 'Atadı',
  'upload': 'Yükledi',
  'department.create': 'Departman oluşturdu',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-md)', fontFamily: 'var(--font-mono)' }}>
      <p className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }}>{entry.name}: <strong>{entry.value.toLocaleString('tr-TR')}</strong></p>
      ))}
    </div>
  );
};

const PIE_COLORS = ['var(--color-success)', 'var(--color-info)', 'var(--color-error)', 'var(--color-warning)'];

/** G3.2 — Anlık aktif kullanıcı sayısını gösteren Presence widget'ı */
function ActiveUsersWidget() {
  const { total, byRole } = useActiveUsersCount()

  const segments = [
    { label: 'Super Admin', count: byRole.super_admin, color: 'var(--color-accent)' },
    { label: 'Hastane Admin', count: byRole.admin, color: 'var(--color-primary)' },
    { label: 'Personel', count: byRole.staff, color: 'var(--color-info)' },
  ]

  return (
    <div
      className="flex items-center gap-4 rounded-2xl border px-5 py-4"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Live indicator + main count */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-success-bg)' }}>
          <Radio className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
          {/* Pulsing dot */}
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-success)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Aktif Kullanıcı</p>
          <p className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--color-text-primary)' }}>{total}</p>
        </div>
      </div>

      <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />

      {/* Role breakdown */}
      <div className="flex items-center gap-5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{seg.label}</span>
            <span className="text-[13px] font-bold font-mono" style={{ color: seg.color }}>{seg.count}</span>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: 'var(--color-success-bg)' }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>Canlı</span>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const { data, isLoading, error } = useFetch<DashboardData>('/api/super-admin/dashboard');

  if (isLoading) return <PageLoading />;
  if (error) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;

  const stats = data?.stats ?? [];
  const alert = data?.alert;
  const monthlyData = data?.monthlyData ?? [];
  const subscriptionData = data?.subscriptionData ?? [];
  const recentHospitals = data?.recentHospitals ?? [];
  const expiringSubscriptions = data?.expiringSubscriptions ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const overview = data?.platformOverview;

  // Pie data for subscription status
  const subPieData = overview ? [
    { name: 'Aktif', value: overview.activeSubscriptions },
    { name: 'Deneme', value: overview.trialSubscriptions },
    { name: 'Süresi Dolmuş', value: overview.expiredSubscriptions },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader title="Platform Dashboard" subtitle="Tüm hastanelerin genel durumu" />
      </BlurFade>

      {/* Alert Banner */}
      {alert && (
        <BlurFade delay={0.02}>
          <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: alert.variant === 'error' ? 'var(--color-error)' : 'var(--color-warning)', background: alert.variant === 'error' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)' }}>
            <BorderBeam size={200} duration={8} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: alert.variant === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">{alert.message}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Hemen kontrol edin</p>
                </div>
              </div>
              <Link href={alert.actionHref}>
                <Button size="sm" className="gap-1 rounded-xl text-xs font-semibold text-white" style={{ background: alert.variant === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                  {alert.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Quick Actions */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className="group flex items-center gap-3 rounded-2xl border p-4 transition-transform duration-200 hover:-translate-y-0.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110" style={{ background: `${action.color}12` }}>
                  <action.icon className="h-5 w-5" style={{ color: action.color }} />
                </div>
                <span className="text-[13px] font-semibold">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </BlurFade>

      {/* G3.2 — Live Active Users */}
      <BlurFade delay={0.04}>
        <ActiveUsersWidget />
      </BlurFade>

      {/* Stat Cards */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = iconMap[stat.icon] ?? Building2;
            return (
              <StatCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                icon={Icon}
                accentColor={stat.accentColor}
                trend={stat.trend}
              />
            );
          })}
        </div>
      </BlurFade>

      {/* Charts Row — Trend + Subscription Pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <BlurFade delay={0.07} className="lg:col-span-4">
          <ChartCard title="Aylık Kayıt Trendi" icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            <div className="h-[300px]">
              {monthlyData.length === 0 ? (
                <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradHospital" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPersonel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-body)' }} />
                    <Area type="monotone" dataKey="hastane" name="Hastane" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#gradHospital)" />
                    <Area type="monotone" dataKey="personel" name="Personel" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gradPersonel)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </BlurFade>

        <BlurFade delay={0.09} className="lg:col-span-3">
          <ChartCard title="Abonelik Dağılımı" icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}>
            <div className="h-[300px]">
              {subscriptionData.length === 0 && subPieData.length === 0 ? (
                <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p></div>
              ) : (
                <div className="flex h-full">
                  {/* Pie chart */}
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={subPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                          {subPieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-body)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Stats sidebar */}
                  {overview && (
                    <div className="flex flex-col justify-center gap-3 pr-2 min-w-[120px]">
                      {[
                        { label: 'Aktif', value: overview.activeSubscriptions, color: 'var(--color-success)' },
                        { label: 'Deneme', value: overview.trialSubscriptions, color: 'var(--color-info)' },
                        { label: 'Süresi Dolmuş', value: overview.expiredSubscriptions, color: 'var(--color-error)' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                          <div>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                            <p className="text-lg font-bold font-mono">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ChartCard>
        </BlurFade>
      </div>

      {/* Platform Health + Subscription Bar Chart */}
      {overview && (
        <BlurFade delay={0.11}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Platform Health Card */}
            <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <Server className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-[15px] font-bold">Platform Durumu</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Aktif Hastane', value: overview.activeHospitalCount, total: overview.hospitalCount, color: 'var(--color-success)' },
                  { label: 'Askıya Alınan', value: overview.suspendedCount, total: overview.hospitalCount, color: 'var(--color-error)' },
                  { label: 'Başarı Oranı', value: overview.completionRate, total: 100, color: 'var(--color-primary)', suffix: '%' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                      <span className="text-[13px] font-bold font-mono">{item.value}{item.suffix ?? `/${item.total}`}</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%`, background: item.color, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription by Plan Bar Chart */}
            <div className="lg:col-span-2">
              <ChartCard title="Plan Bazlı Abonelik" icon={<CreditCard className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}>
                <div className="h-[220px]">
                  {subscriptionData.length === 0 ? (
                    <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p></div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={subscriptionData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="plan" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-body)' }} />
                        <Bar dataKey="aktif" name="Aktif" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar dataKey="trial" name="Deneme" fill="var(--color-info)" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar dataKey="suresiDoldu" name="Süresi Doldu" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Recent Hospitals + Expiring Subscriptions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BlurFade delay={0.13}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                  <Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-[15px] font-bold">Son Kayıt Olan Hastaneler</h3>
              </div>
              <Link href="/super-admin/hospitals" className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Tümünü Gör <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {recentHospitals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ background: 'var(--color-bg)' }}>
                  <Building2 className="h-6 w-6" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz hastane kaydı yok</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentHospitals.map((hospital, idx) => (
                  <Link key={hospital.id} href={`/super-admin/hospitals/${hospital.id}`}>
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150" style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: idx === 0 ? 'var(--color-accent)' : idx === 1 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                        {idx + 1}
                      </div>
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold text-white" style={{ background: planColors[hospital.plan] || 'var(--color-primary)' }}>
                          {hospital.name?.slice(0, 2).toUpperCase() ?? ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold">{hospital.name}</p>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="font-mono">{hospital.code}</span>
                          <span>·</span>
                          <span>{hospital.registeredAt}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${planColors[hospital.plan] ?? 'var(--color-info)'}15`, color: planColors[hospital.plan] ?? 'var(--color-info)' }}>
                          {hospital.plan}
                        </span>
                        <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>{hospital.staffCount} personel</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-warning-bg)' }}>
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
              </div>
              <h3 className="text-[15px] font-bold">Aboneliği Sona Yaklaşan</h3>
              {expiringSubscriptions.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-warning)' }}>
                  {expiringSubscriptions.length}
                </span>
              )}
            </div>

            {expiringSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ background: 'var(--color-success-bg)' }}>
                  <Shield className="h-6 w-6" style={{ color: 'var(--color-success)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>Tüm abonelikler güncel</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringSubscriptions.map((sub) => {
                  const urgency = statusUrgency[sub.status] ?? statusUrgency.info;
                  return (
                    <div key={sub.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: `${urgency.bg}` }}>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold">{sub.name}</p>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="font-mono">{sub.code}</span>
                          <span>·</span>
                          <span>{sub.plan}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          <Calendar className="h-3 w-3" />
                          <span className="font-mono">{sub.expiresAt}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: urgency.bg, color: urgency.text, border: `1px solid ${urgency.text}20` }}>
                          <Clock className="h-3 w-3" />
                          {sub.daysLeft} gün
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </BlurFade>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <BlurFade delay={0.17}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
                <Activity className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
              </div>
              <h3 className="text-[15px] font-bold">Son Aktiviteler</h3>
            </div>
            <div className="space-y-1">
              {recentActivity.map((act, idx) => {
                const dotColor = typeColors[act.type] ?? 'var(--color-text-muted)';
                return (
                  <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ transition: 'background var(--transition-fast)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px]">
                        <strong className="font-semibold">{act.user}</strong>
                        <span style={{ color: 'var(--color-text-muted)' }}> {actionLabels[act.action] ?? act.action} </span>
                        <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>({act.entityType})</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>{act.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
