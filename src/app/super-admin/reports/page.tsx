'use client';

import {
  BarChart3, Download, FileText, Building2, Users, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { StatCard } from '@/components/shared/stat-card';

const overviewStats = [
  { title: 'Toplam Tamamlanma', value: '87.3%', icon: TrendingUp, accentColor: 'var(--color-primary)', trend: { value: 2.1, label: 'vs geçen ay', isPositive: true } },
  { title: 'Ortalama Başarı Puanı', value: '78.5', icon: BarChart3, accentColor: 'var(--color-accent)', trend: { value: 3.2, label: 'vs geçen ay', isPositive: true } },
  { title: 'Aktif Hastane', value: 18, icon: Building2, accentColor: 'var(--color-info)' },
  { title: 'Toplam Personel', value: 3842, icon: Users, accentColor: 'var(--color-success)' },
];

const hospitalComparison = [
  { name: 'Devakent', tamamlanma: 92, basari: 85 },
  { name: 'Anadolu', tamamlanma: 88, basari: 79 },
  { name: 'Marmara', tamamlanma: 85, basari: 82 },
  { name: 'Karadeniz', tamamlanma: 80, basari: 76 },
  { name: 'Ege Şifa', tamamlanma: 78, basari: 71 },
  { name: 'İç Anadolu', tamamlanma: 73, basari: 68 },
];

const subscriptionRevenue = [
  { name: 'Başlangıç', value: 12000, color: 'var(--color-info)' },
  { name: 'Profesyonel', value: 48000, color: 'var(--color-accent)' },
  { name: 'Kurumsal', value: 60000, color: 'var(--color-primary)' },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Raporlar"
        subtitle="Platform geneli performans ve istatistikler"
        action={{ label: 'Excel Export', icon: Download }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <ChartCard title="Hastane Karşılaştırması" icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />} className="lg:col-span-4">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
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
          </div>
        </ChartCard>

        <ChartCard title="Gelir Dağılımı" icon={<FileText className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} className="lg:col-span-3">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
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
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
