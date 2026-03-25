'use client';

import {
  Users, GraduationCap, TrendingUp, AlertTriangle, Trophy, Activity, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/layouts/topbar/alert-banner';
import { ChartCard } from '@/components/shared/chart-card';

const stats = [
  { title: 'Toplam Personel', value: 245, icon: Users, accentColor: 'var(--color-primary)', trend: { value: 12, label: 'yeni kayıt', isPositive: true } },
  { title: 'Aktif Eğitim', value: 32, icon: GraduationCap, accentColor: 'var(--color-accent)', trend: { value: 5, label: 'vs geçen ay', isPositive: true } },
  { title: 'Tamamlanma Oranı', value: '89.2%', icon: TrendingUp, accentColor: 'var(--color-success)', trend: { value: 3.4, label: 'vs geçen ay', isPositive: true } },
  { title: 'Başarısız Personel', value: 8, icon: AlertTriangle, accentColor: 'var(--color-error)', trend: { value: -2, label: 'vs geçen ay', isPositive: true } },
];

const trendData = [
  { month: 'Oca', oran: 72 }, { month: 'Şub', oran: 75 }, { month: 'Mar', oran: 78 },
  { month: 'Nis', oran: 80 }, { month: 'May', oran: 83 }, { month: 'Haz', oran: 81 },
  { month: 'Tem', oran: 84 }, { month: 'Ağu', oran: 86 }, { month: 'Eyl', oran: 85 },
  { month: 'Eki', oran: 87 }, { month: 'Kas', oran: 88 }, { month: 'Ara', oran: 89 },
];

const topPerformers = [
  { name: 'Elif Kaya', department: 'Hemşirelik', score: 97, courses: 8, initials: 'EK', color: 'var(--color-primary)' },
  { name: 'Mehmet Demir', department: 'Acil Servis', score: 95, courses: 7, initials: 'MD', color: 'var(--color-accent)' },
  { name: 'Ayşe Yıldız', department: 'Radyoloji', score: 94, courses: 6, initials: 'AY', color: 'var(--color-info)' },
  { name: 'Mustafa Öz', department: 'Laboratuvar', score: 92, courses: 8, initials: 'MÖ', color: 'var(--color-success)' },
  { name: 'Zeynep Arslan', department: 'Eczane', score: 91, courses: 5, initials: 'ZA', color: 'var(--color-warning)' },
];

const recentActivity = [
  { action: 'Enfeksiyon Kontrol eğitimini tamamladı', user: 'Elif Kaya', time: '15 dk önce', type: 'success' },
  { action: 'İş Güvenliği sınavında başarısız oldu', user: 'Ali Veli', time: '1 saat önce', type: 'error' },
  { action: 'Yeni eğitim oluşturuldu: Hasta Hakları', user: 'Dr. Ahmet Yılmaz', time: '3 saat önce', type: 'info' },
  { action: '12 personele eğitim atandı', user: 'Fatma Demir', time: '5 saat önce', type: 'warning' },
  { action: 'Radyoloji Güvenliği videoları izlendi', user: 'Ayşe Yıldız', time: '1 gün önce', type: 'success' },
  { action: 'Personel eklendi: Hasan Kılıç', user: 'Dr. Ahmet Yılmaz', time: '1 gün önce', type: 'info' },
];

const typeColors: Record<string, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
};

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Devakent Hastanesi genel durumu" />

      <AlertBanner
        message="5 personelin eğitim bitiş tarihi bu hafta doluyor. Hatırlatma gönderin."
        actionLabel="Bildirimlere Git"
        actionHref="/admin/notifications"
        variant="warning"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Completion Trend Chart */}
      <ChartCard
        title="Tamamlanma Trendi"
        icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
      >
        <div className="h-75">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientOran" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value}%`, 'Tamamlanma']}
              />
              <Area type="monotone" dataKey="oran" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gradientOran)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Bottom: Top Performers + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
              <Trophy className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              En Başarılı Personeller
            </h3>
          </div>
          <div className="space-y-3">
            {topPerformers.map((person, idx) => (
              <div
                key={person.name}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ transition: 'background var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: idx < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  {idx + 1}
                </div>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: person.color }}>
                    {person.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{person.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{person.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{person.score}%</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{person.courses} eğitim</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
              <Activity className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Son Aktiviteler
            </h3>
          </div>
          <div className="space-y-4">
            {recentActivity.map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: typeColors[item.type] }} />
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="font-semibold">{item.user}</span>{' '}
                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.action}</span>
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
