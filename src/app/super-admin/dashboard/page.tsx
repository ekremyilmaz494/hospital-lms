'use client';

import {
  Building2,
  CreditCard,
  Users,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/layouts/topbar/alert-banner';
import { DashboardCharts } from '@/components/super-admin/dashboard-charts';
import { DashboardLists } from '@/components/super-admin/dashboard-lists';
import { useFetch } from '@/hooks/use-fetch';

interface DashboardStat {
  title: string;
  value: number | string;
  icon: string;
  accentColor: string;
  trend?: { value: number; label: string; isPositive: boolean };
}

interface DashboardData {
  stats: DashboardStat[];
  alert?: { message: string; actionLabel: string; actionHref: string; variant: string };
}

import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Building2, CreditCard, Users, GraduationCap, TrendingUp, AlertTriangle,
};

export default function SuperAdminDashboard() {
  const { data, isLoading, error } = useFetch<DashboardData>('/api/super-admin/dashboard');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const stats = data?.stats ?? [];
  const alert = data?.alert;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        subtitle="Tüm hastanelerin genel durumu"
      />

      {/* Alert Banner */}
      {alert && (
        <AlertBanner
          message={alert.message}
          actionLabel={alert.actionLabel}
          actionHref={alert.actionHref}
          variant={alert.variant as 'warning' | 'info' | 'error'}
        />
      )}

      {/* Stat Cards */}
      {stats.length === 0 ? (
        <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      )}

      {/* Charts */}
      <DashboardCharts />

      {/* Lists */}
      <DashboardLists />
    </div>
  );
}
