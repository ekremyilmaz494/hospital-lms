'use client';

import { CheckCircle, XCircle, Clock, Minus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useState } from 'react';

interface Cell { trainingId: string; state: string; score?: number | null; certStatus?: string | null }
interface StaffRow { id: string; name: string; department: string; cells: Cell[]; completionRate: number }
interface Training { id: string; title: string; isCompulsory: boolean }
interface MatrixData { trainings: Training[]; staff: StaffRow[]; summary: { totalStaff: number; totalTrainings: number; compulsoryTrainings: number } }

const stateConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  passed: { icon: CheckCircle, color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Başarılı' },
  failed: { icon: XCircle, color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: 'Başarısız' },
  in_progress: { icon: Clock, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', label: 'Devam' },
  assigned: { icon: Clock, color: 'var(--color-info)', bg: 'var(--color-info-bg)', label: 'Atandı' },
  unassigned: { icon: Minus, color: 'var(--color-text-muted)', bg: 'transparent', label: 'Atanmadı' },
};

export default function CompetencyMatrixPage() {
  const { data, isLoading } = useFetch<MatrixData>('/api/admin/competency-matrix');
  const [deptFilter, setDeptFilter] = useState('all');

  if (isLoading) return <PageLoading />;

  const trainings = data?.trainings ?? [];
  const staff = data?.staff ?? [];
  const departments = [...new Set(staff.map(s => s.department))].sort();
  const filtered = deptFilter === 'all' ? staff : staff.filter(s => s.department === deptFilter);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <PageHeader title="Yetkinlik Matrisi" subtitle={`${staff.length} personel × ${trainings.length} eğitim`} />
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Toplam Personel', value: data?.summary.totalStaff ?? 0, color: 'var(--color-primary)' },
            { label: 'Aktif Eğitim', value: data?.summary.totalTrainings ?? 0, color: 'var(--color-info)' },
            { label: 'Zorunlu Eğitim', value: data?.summary.compulsoryTrainings ?? 0, color: 'var(--color-error)' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <option value="all">Tüm Departmanlar ({staff.length})</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </BlurFade>

      <BlurFade delay={0.15}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="sticky left-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)', minWidth: 180 }}>Personel</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Oran</th>
                  {trainings.map(t => (
                    <th key={t.id} className="px-2 py-3 text-center text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)', minWidth: 44 }} title={t.title}>
                      <div className="flex flex-col items-center gap-0.5">
                        {t.isCompulsory && <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-error)' }} />}
                        <span className="max-w-[80px] truncate block">{t.title.length > 12 ? t.title.slice(0, 12) + '…' : t.title}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="sticky left-0 z-10 px-4 py-2.5" style={{ background: 'var(--color-surface)' }}>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{s.department}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-bold font-mono" style={{ color: s.completionRate >= 80 ? 'var(--color-success)' : s.completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>%{s.completionRate}</span>
                    </td>
                    {s.cells.map(cell => {
                      const cfg = stateConfig[cell.state] ?? stateConfig.unassigned;
                      const Icon = cfg.icon;
                      return (
                        <td key={cell.trainingId} className="px-2 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-0.5" title={`${cfg.label}${cell.score != null ? ` — %${cell.score}` : ''}`}>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: cfg.bg }}>
                              <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                            </div>
                            {cell.score != null && <span className="text-[10px] font-mono font-bold" style={{ color: cfg.color }}>{cell.score}</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>Personel bulunamadı</div>}
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {Object.entries(stateConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded" style={{ background: cfg.bg }}><Icon className="h-3 w-3" style={{ color: cfg.color }} /></div>
                {cfg.label}
              </div>
            );
          })}
        </div>
      </BlurFade>
    </div>
  );
}
