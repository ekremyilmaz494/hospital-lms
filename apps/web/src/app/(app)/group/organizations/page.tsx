'use client';

import { Building2, Users, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { GroupDrillInButton } from './drill-in-button';

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
  hospitals: Hospital[];
}

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-success)';
  if (rate >= 60) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export default function GroupOrganizationsPage() {
  const { data, isLoading, error } = useFetch<GroupDashboard>('/api/group/dashboard');

  if (isLoading) return <PageLoading />;
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error ?? 'Veri yüklenemedi'}</div>
      </div>
    );

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader title="Hastaneler" subtitle="Gruptaki hastaneleri yönetin — bir hastaneye girip düzenleme yapın" />
      </BlurFade>

      <BlurFade delay={0.03}>
        {data.hospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <Building2 className="h-7 w-7 mb-3" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[15px] font-bold mb-1">Hastane yok</p>
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Bu gruba henüz hastane bağlanmadı. Klinovax yöneticinizle iletişime geçin.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.hospitals.map((h) => (
              <div key={h.id} className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)', opacity: h.isSuspended ? 0.8 : 1 }}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0" style={{ background: 'var(--color-bg)' }}>
                      <Building2 className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold truncate">{h.name}</h3>
                        {h.isSuspended && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>Askıda</span>
                        )}
                      </div>
                      <p className="text-[12px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{h.code}</p>
                    </div>
                  </div>
                  <GroupDrillInButton organizationId={h.id} disabled={h.isSuspended} />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Personel', value: h.staffCount, icon: Users, color: 'var(--color-text-primary)' },
                    { label: 'Eğitim', value: h.activeTrainingCount, icon: GraduationCap, color: 'var(--color-text-primary)' },
                    { label: 'Tamamlanma', value: `%${h.completionRate}`, color: rateColor(h.completionRate) },
                    { label: 'Geciken', value: h.overdueCount, color: h.overdueCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl px-2 py-2 text-center" style={{ background: 'var(--color-bg)' }}>
                      <p className="text-[15px] font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </BlurFade>
    </div>
  );
}
