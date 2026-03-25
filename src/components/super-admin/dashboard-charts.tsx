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

// Mock data — Monthly registrations
const monthlyData = [
  { month: 'Oca', hastane: 2, personel: 320 },
  { month: 'Şub', hastane: 1, personel: 280 },
  { month: 'Mar', hastane: 3, personel: 450 },
  { month: 'Nis', hastane: 2, personel: 380 },
  { month: 'May', hastane: 4, personel: 520 },
  { month: 'Haz', hastane: 3, personel: 490 },
  { month: 'Tem', hastane: 2, personel: 410 },
  { month: 'Ağu', hastane: 5, personel: 680 },
  { month: 'Eyl', hastane: 3, personel: 540 },
  { month: 'Eki', hastane: 4, personel: 620 },
  { month: 'Kas', hastane: 2, personel: 380 },
  { month: 'Ara', hastane: 3, personel: 450 },
];

// Mock data — Subscription breakdown
const subscriptionData = [
  { plan: 'Başlangıç', aktif: 8, trial: 3, suresiDoldu: 1 },
  { plan: 'Profesyonel', aktif: 6, trial: 1, suresiDoldu: 0 },
  { plan: 'Kurumsal', aktif: 4, trial: 0, suresiDoldu: 0 },
];

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
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
      {/* Monthly Registrations — wider */}
      <ChartCard
        title="Aylık Kayıt Trendi"
        icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
        className="lg:col-span-4"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </ChartCard>

      {/* Subscription Breakdown — narrower */}
      <ChartCard
        title="Abonelik Dağılımı"
        icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
        className="lg:col-span-3"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </ChartCard>
    </div>
  );
}
