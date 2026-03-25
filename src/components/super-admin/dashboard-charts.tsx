'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { ChartCard } from '@/components/shared/chart-card';
import { useFetch } from '@/hooks/use-fetch';

interface MonthlyEntry {
  month: string;
  hastane: number;
  personel: number;
}

interface SubscriptionEntry {
  plan: string;
  aktif: number;
  trial: number;
  suresiDoldu: number;
}

interface ChartsData {
  monthlyData: MonthlyEntry[];
  subscriptionData: SubscriptionEntry[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{
        background: 'var(--color-surface-elevated)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-md)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <p className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value.toLocaleString('tr-TR')}</strong>
        </p>
      ))}
    </div>
  );
};

export function DashboardCharts() {
  const { data, isLoading, error } = useFetch<ChartsData>('/api/super-admin/dashboard');

  const monthlyData = data?.monthlyData ?? [];
  const subscriptionData = data?.subscriptionData ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Yükleniyor...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
      {/* Monthly Registrations — wider */}
      <ChartCard
        title="Aylık Kayıt Trendi"
        icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
        className="lg:col-span-4"
      >
        <div className="h-[300px]">
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-full"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientPersonel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-body)' }}
                />
                <Area
                  type="monotone"
                  dataKey="personel"
                  name="Yeni Personel"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#gradientPersonel)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Subscription Breakdown — narrower */}
      <ChartCard
        title="Abonelik Dağılımı"
        icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
        className="lg:col-span-3"
      >
        <div className="h-[300px]">
          {subscriptionData.length === 0 ? (
            <div className="flex items-center justify-center h-full"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={subscriptionData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="plan"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-body)' }} />
                <Bar dataKey="aktif" name="Aktif" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="trial" name="Deneme" fill="var(--color-info)" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="suresiDoldu" name="Süresi Doldu" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
