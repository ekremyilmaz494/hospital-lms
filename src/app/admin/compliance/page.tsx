'use client';

import { ShieldCheck, AlertTriangle, Clock, CheckCircle, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { StatCard } from '@/components/shared/stat-card';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface TrainingComp {
  id: string; title: string; regulatoryBody: string | null; complianceDeadline: string | null; deadlineStatus: string;
  stats: { totalAssigned: number; passed: number; failed: number; notStarted: number; inProgress: number; unassigned: number; complianceRate: number };
}
interface CompData {
  summary: { totalCompulsoryTrainings: number; fullyCompliantTrainings: number; overallComplianceRate: number; totalStaff: number; urgentDeadlineCount: number };
  trainingCompliance: TrainingComp[];
  urgentDeadlines: { title: string; deadline: string | null; status: string; complianceRate: number; nonCompliantCount: number }[];
  departmentCompliance: { dept: string; rate: number }[];
}

const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' };
const deadlineColors: Record<string, { color: string; bg: string; label: string }> = {
  overdue: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: 'Süresi Geçti' },
  critical: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: 'Kritik' },
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', label: 'Yaklaşıyor' },
  ok: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Uygun' },
};

export default function CompliancePage() {
  const { data, isLoading } = useFetch<CompData>('/api/admin/compliance');
  if (isLoading) return <PageLoading />;

  const summary = data?.summary;
  const trainings = data?.trainingCompliance ?? [];
  const urgentDeadlines = data?.urgentDeadlines ?? [];
  const deptCompliance = data?.departmentCompliance ?? [];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}><PageHeader title="Uyum Raporu" subtitle="Zorunlu eğitimler ve yasal uyum durumu" /></BlurFade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Genel Uyum', value: `%${summary?.overallComplianceRate ?? 0}`, icon: ShieldCheck, accentColor: (summary?.overallComplianceRate ?? 0) >= 80 ? 'var(--color-success)' : 'var(--color-error)' },
          { title: 'Zorunlu Eğitim', value: summary?.totalCompulsoryTrainings ?? 0, icon: AlertTriangle, accentColor: 'var(--color-warning)' },
          { title: 'Tam Uyumlu', value: summary?.fullyCompliantTrainings ?? 0, icon: CheckCircle, accentColor: 'var(--color-success)' },
          { title: 'Acil Deadline', value: summary?.urgentDeadlineCount ?? 0, icon: Clock, accentColor: 'var(--color-error)' },
        ].map((s, i) => (
          <BlurFade key={s.title} delay={0.05 + i * 0.03}><StatCard {...s} /></BlurFade>
        ))}
      </div>

      {urgentDeadlines.length > 0 && (
        <BlurFade delay={0.15}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>Acil Dikkat Gerektiren</h3>
            </div>
            <div className="space-y-2">
              {urgentDeadlines.map(d => {
                const cfg = deadlineColors[d.status] ?? deadlineColors.ok;
                return (
                  <div key={d.title} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-semibold">{d.title}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Son: {d.deadline?.split('T')[0] ?? '—'}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </BlurFade>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0.2}>
          <ChartCard title="Departman Uyumu" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            {deptCompliance.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={deptCompliance} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="rate" name="Uyum %" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Departman verisi yok</div>}
          </ChartCard>
        </BlurFade>

        <BlurFade delay={0.25} className="lg:col-span-2">
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}><h3 className="text-sm font-bold">Zorunlu Eğitim Durumu</h3></div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  {['Eğitim', 'Düzenleyici', 'Son Tarih', 'Durum', 'Tamamlayan', 'Uyum %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainings.map(t => {
                  const cfg = deadlineColors[t.deadlineStatus] ?? deadlineColors.ok;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-3 font-semibold">{t.title}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.regulatoryBody ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{t.complianceDeadline?.split('T')[0] ?? '—'}</td>
                      <td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                      <td className="px-4 py-3 font-mono text-xs"><span style={{ color: 'var(--color-success)' }}>{t.stats.passed}</span> / {t.stats.totalAssigned}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full" style={{ background: 'var(--color-bg)' }}>
                            <div className="h-full rounded-full" style={{ width: `${t.stats.complianceRate}%`, background: t.stats.complianceRate >= 80 ? 'var(--color-success)' : t.stats.complianceRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }} />
                          </div>
                          <span className="text-xs font-bold font-mono" style={{ color: t.stats.complianceRate >= 80 ? 'var(--color-success)' : 'var(--color-error)' }}>%{t.stats.complianceRate}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {trainings.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>Zorunlu eğitim tanımlı değil</div>}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
