'use client';

import {
  BarChart3, Download, FileText, Building2, Users, TrendingUp,
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { exportExcel } from '@/lib/export';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { StatCard } from '@/components/shared/stat-card';
import { useFetch } from '@/hooks/use-fetch';

interface ReportStat {
  title: string;
  value: string | number;
  icon: string;
  accentColor: string;
  trend?: { value: number; label: string; isPositive: boolean };
}

interface HospitalComparison {
  name: string;
  tamamlanma: number;
  basari: number;
}

interface RevenueEntry {
  name: string;
  value: number;
  color: string;
}

interface ReportsData {
  overviewStats: ReportStat[];
  hospitalComparison: HospitalComparison[];
  subscriptionRevenue: RevenueEntry[];
}

import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  TrendingUp, BarChart3, Building2, Users,
};

export default function ReportsPage() {
  const { data, isLoading, error } = useFetch<ReportsData>('/api/super-admin/reports');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const overviewStats = data?.overviewStats ?? [];
  const hospitalComparison = data?.hospitalComparison ?? [];
  const subscriptionRevenue = data?.subscriptionRevenue ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Raporlar"
        subtitle="Platform geneli performans ve istatistikler"
        action={{ label: 'Excel', icon: Download, onClick: exportExcel }}
      />

      {overviewStats.length === 0 ? (
        <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overviewStats.map((stat) => {
            const Icon = iconMap[stat.icon] ?? TrendingUp;
            return <StatCard key={stat.title} title={stat.title} value={stat.value} icon={Icon} accentColor={stat.accentColor} trend={stat.trend} />;
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <ChartCard title="Hastane Karşılaştırması" icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />} className="lg:col-span-4">
          <div className="h-[300px]">
            {hospitalComparison.length === 0 ? (
              <div className="flex items-center justify-center h-full"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={hospitalComparison} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="tamamlanma" name="Tamamlanma %" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="basari" name="Başarı %" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Gelir Dağılımı" icon={<FileText className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} className="lg:col-span-3">
          <div className="h-[300px]">
            {subscriptionRevenue.length === 0 ? (
              <div className="flex items-center justify-center h-full"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={subscriptionRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {subscriptionRevenue.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₺${Number(value).toLocaleString('tr-TR')}`} contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
