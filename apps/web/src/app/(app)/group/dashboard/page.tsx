'use client';

import { Users, GraduationCap, TrendingUp, AlertTriangle, ShieldCheck, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface Hospital {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSuspended: boolean;
  staffCount: number;
  activeTrainingCount: number;
  completionRate: number;
  overdueCount: number;
  complianceRate: number | null;
}

interface GroupDashboard {
  groupName: string;
  hospitalCount: number;
  totals: {
    totalStaff: number;
    totalActiveStaff: number;
    totalActiveTrainings: number;
    completionRate: number;
    totalOverdue: number;
    complianceRate: number | null;
  };
  hospitals: Hospital[];
}

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-success)';
  if (rate >= 60) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export default function GroupDashboardPage() {
  const { data, isLoading, error } = useFetch<GroupDashboard>('/api/group/dashboard');

  if (isLoading) return <PageLoading />;
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error ?? 'Veri yüklenemedi'}</div>
      </div>
    );

  const t = data.totals;
  const stats = [
    { title: 'Toplam Personel', value: t.totalStaff, sub: `${t.totalActiveStaff} aktif`, icon: Users, color: 'var(--color-primary)' },
    { title: 'Aktif Eğitim', value: t.totalActiveTrainings, sub: `${data.hospitalCount} hastane`, icon: GraduationCap, color: 'var(--color-info)' },
    { title: 'Tamamlanma', value: `%${t.completionRate}`, sub: 'grup geneli', icon: TrendingUp, color: 'var(--color-success)' },
    { title: 'Geciken Eğitim', value: t.totalOverdue, sub: 'tüm hastaneler', icon: AlertTriangle, color: 'var(--color-error)' },
    { title: 'Uyum Oranı', value: t.complianceRate != null ? `%${t.complianceRate}` : '—', sub: 'zorunlu eğitim', icon: ShieldCheck, color: t.complianceRate != null ? rateColor(t.complianceRate) : 'var(--color-text-muted)' },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader title={data.groupName} subtitle={`${data.hospitalCount} hastanenin konsolide görünümü`} />
      </BlurFade>

      {/* Consolidated KPIs */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.title} className="rounded-2xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${s.color}12` }}>
                  <s.icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.title}</p>
              </div>
              <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Per-hospital comparison */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <h3 className="text-[14px] font-bold">Hastane Karşılaştırması</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left font-semibold px-5 py-2.5">Hastane</th>
                  <th className="text-right font-semibold px-3 py-2.5">Personel</th>
                  <th className="text-right font-semibold px-3 py-2.5">Aktif Eğitim</th>
                  <th className="text-right font-semibold px-3 py-2.5">Tamamlanma</th>
                  <th className="text-right font-semibold px-3 py-2.5">Geciken</th>
                  <th className="text-right font-semibold px-5 py-2.5">Uyum</th>
                </tr>
              </thead>
              <tbody>
                {data.hospitals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      Bu gruba henüz hastane bağlanmadı.
                    </td>
                  </tr>
                ) : (
                  data.hospitals.map((h) => (
                    <tr key={h.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{h.name}</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>{h.code}</span>
                          {h.isSuspended && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>Askıda</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{h.staffCount}</td>
                      <td className="px-3 py-3 text-right font-mono">{h.activeTrainingCount}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: rateColor(h.completionRate) }}>%{h.completionRate}</td>
                      <td className="px-3 py-3 text-right font-mono" style={{ color: h.overdueCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{h.overdueCount}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold" style={{ color: h.complianceRate != null ? rateColor(h.complianceRate) : 'var(--color-text-muted)' }}>
                        {h.complianceRate != null ? `%${h.complianceRate}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
