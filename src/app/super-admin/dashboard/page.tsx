'use client';

import {
  Building2,
  CreditCard,
  Users,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/layouts/topbar/alert-banner';
import { DashboardCharts } from '@/components/super-admin/dashboard-charts';
import { DashboardLists } from '@/components/super-admin/dashboard-lists';

// Mock data
const stats = [
  {
    title: 'Toplam Hastane',
    value: 24,
    icon: Building2,
    accentColor: 'var(--color-primary)',
    trend: { value: 12, label: 'vs geçen ay', isPositive: true },
  },
  {
    title: 'Aktif Abonelik',
    value: 18,
    icon: CreditCard,
    accentColor: 'var(--color-info)',
    trend: { value: 8, label: 'vs geçen ay', isPositive: true },
  },
  {
    title: 'Toplam Personel',
    value: 3842,
    icon: Users,
    accentColor: 'var(--color-accent)',
    trend: { value: 528, label: 'yeni kayıt', isPositive: true },
  },
  {
    title: 'Aktif Eğitim',
    value: 156,
    icon: GraduationCap,
    accentColor: 'var(--color-success)',
    trend: { value: 23, label: 'vs geçen ay', isPositive: true },
  },
  {
    title: 'Tamamlanma Oranı',
    value: '87.3%',
    icon: TrendingUp,
    accentColor: 'var(--color-primary)',
    trend: { value: 2.1, label: 'vs geçen ay', isPositive: true },
  },
  {
    title: 'Askıya Alınan',
    value: 3,
    icon: AlertTriangle,
    accentColor: 'var(--color-error)',
    trend: { value: -1, label: 'vs geçen ay', isPositive: true },
  },
];

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        subtitle="Tüm hastanelerin genel durumu"
      />

      {/* Alert Banner */}
      <AlertBanner
        message="3 hastanenin abonelik süresi bu hafta doluyor. Yenileme bildirimlerini kontrol edin."
        actionLabel="Abonelikleri Gör"
        actionHref="/super-admin/subscriptions"
        variant="warning"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            accentColor={stat.accentColor}
            trend={stat.trend}
          />
        ))}
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Lists */}
      <DashboardLists />
    </div>
  );
}
