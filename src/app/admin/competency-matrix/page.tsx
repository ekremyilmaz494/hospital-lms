'use client';

import { CheckCircle, XCircle, Clock, Minus, AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useState } from 'react';

interface Cell { trainingId: string; state: string; score?: number | null; certStatus?: string | null }
interface StaffRow { id: string; name: string; department: string; cells: Cell[]; completionRate: number }
interface Training { id: string; title: string; isCompulsory: boolean }
interface MatrixData {
  trainings: Training[];
  staff: StaffRow[];
  summary: { totalStaff: number; totalTrainings: number; compulsoryTrainings: number }
}

const stateConfig: Record<string, { icon: typeof CheckCircle; bg: string; border: string; color: string; label: string }> = {
  passed:      { icon: CheckCircle, bg: 'var(--color-success-bg)',  border: 'var(--color-success)',  color: 'var(--color-success)',  label: 'Başarılı' },
  failed:      { icon: XCircle,     bg: 'var(--color-error-bg)',    border: 'var(--color-error)',    color: 'var(--color-error)',    label: 'Başarısız' },
  in_progress: { icon: Clock,       bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', color: 'var(--color-warning)', label: 'Devam' },
  assigned:    { icon: Clock,       bg: 'var(--color-info-bg)',     border: 'var(--color-info)',     color: 'var(--color-info)',     label: 'Atandı' },
  unassigned:  { icon: Minus,       bg: 'transparent',              border: 'var(--color-border)',   color: 'var(--color-text-muted)', label: 'Atanmadı' },
};

const nameHue = (name: string) => name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export default function CompetencyMatrixPage() {
  const { data, isLoading } = useFetch<MatrixData>('/api/admin/competency-matrix');
  const [deptFilter, setDeptFilter] = useState('all');
  const [search, setSearch] = useState('');

  if (isLoading) return <PageLoading />;

  const trainings = data?.trainings ?? [];
  const staff = data?.staff ?? [];
  const departments = [...new Set(staff.map(s => s.department))].sort();

  const filtered = staff.filter(s => {
    const matchesDept = deptFilter === 'all' || s.department === deptFilter;
    const matchesSearch = search.trim() === '' || s.name.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const summaryCards = [
    { label: 'Toplam Personel', value: data?.summary.totalStaff ?? 0, color: 'var(--color-primary)', bg: 'var(--color-primary-light)', icon: '👥' },
    { label: 'Aktif Eğitim',    value: data?.summary.totalTrainings ?? 0, color: 'var(--color-info)', bg: 'var(--color-info-bg)',       icon: '📚' },
    { label: 'Zorunlu Eğitim',  value: data?.summary.compulsoryTrainings ?? 0, color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: '⚠️' },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <PageHeader title="Yetkinlik Matrisi" subtitle={`${staff.length} personel × ${trainings.length} eğitim`} />
      </BlurFade>

      {/* Summary cards */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-3 gap-4">
          {summaryCards.map(s => (
            <div
              key={s.label}
              className="rounded-2xl border p-5"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                  style={{ background: s.bg }}
                >
                  {s.icon}
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.08}>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', minWidth: 220 }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Personel ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm font-medium outline-none"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tüm Departmanlar ({staff.length})</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {filtered.length !== staff.length && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              {filtered.length} sonuç
            </span>
          )}
        </div>
      </BlurFade>

      {/* Matrix table */}
      <BlurFade delay={0.12}>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {/* Sticky name column */}
                  <th
                    className="sticky left-0 z-10 px-5 py-3.5 text-left"
                    style={{ background: 'var(--color-bg)', minWidth: 192, borderRight: '1px solid var(--color-border)' }}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</span>
                  </th>
                  {/* Completion rate column */}
                  <th className="px-4 py-3.5 text-center" style={{ minWidth: 80 }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Oran</span>
                  </th>
                  {/* Training columns */}
                  {trainings.map(t => (
                    <th key={t.id} className="px-2 py-3.5 text-center" style={{ minWidth: 44, verticalAlign: 'bottom' }}>
                      <div className="flex flex-col items-center gap-1.5">
                        {t.isCompulsory && (
                          <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: 'var(--color-error)' }} />
                        )}
                        <span
                          style={{
                            writingMode: 'vertical-lr',
                            transform: 'rotate(180deg)',
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            letterSpacing: '0.03em',
                            height: 62,
                            lineHeight: 1.25,
                            display: 'block',
                            overflow: 'hidden',
                          }}
                          title={t.title}
                        >
                          {t.title.length > 14 ? t.title.slice(0, 14) + '…' : t.title}
                        </span>
                        {/* Column indicator dot */}
                        <span
                          style={{
                            width: 5, height: 5, borderRadius: '50%', display: 'block',
                            background: t.isCompulsory ? 'var(--color-error)' : 'var(--color-info)',
                          }}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, si) => {
                  const rate = s.completionRate;
                  const rateColor = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
                  const hue = nameHue(s.name);
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: si < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Sticky name cell */}
                      <td
                        className="sticky left-0 z-10 px-5 py-3"
                        style={{
                          background: 'var(--color-surface)',
                          borderRight: '1px solid var(--color-border)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: `hsl(${hue}, 52%, 52%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800, color: '#fff',
                              boxShadow: `0 1px 4px hsl(${hue}deg 52% 52% / 40%)`,
                            }}
                          >
                            {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{s.name}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{s.department}</p>
                          </div>
                        </div>
                      </td>

                      {/* Completion rate */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>%{rate}</span>
                          <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate}%`, background: rateColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      </td>

                      {/* State cells */}
                      {s.cells.map(cell => {
                        const cfg = stateConfig[cell.state] ?? stateConfig.unassigned;
                        const Icon = cfg.icon;
                        const isUnset = cell.state === 'unassigned';
                        return (
                          <td key={cell.trainingId} className="px-2 py-3 text-center">
                            <div
                              className="mx-auto flex flex-col items-center gap-0.5"
                              title={`${cfg.label}${cell.score != null ? ` — %${cell.score}` : ''}`}
                            >
                              <div
                                style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: cfg.bg,
                                  border: `2px solid ${cfg.border}`,
                                  opacity: isUnset ? 0.3 : 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: isUnset ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                                }}
                              >
                                <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                              </div>
                              {cell.score != null && (
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: cfg.color }}>
                                  {cell.score}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Personel bulunamadı
            </div>
          )}
        </div>
      </BlurFade>

      {/* Legend */}
      <BlurFade delay={0.18}>
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-5 py-3.5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</span>
          <div className="h-4 w-px" style={{ background: 'var(--color-border)' }} />
          {Object.entries(stateConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: cfg.bg,
                    border: `2px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon style={{ width: 10, height: 10, color: cfg.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{cfg.label}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-error)' }} />
            Kırmızı nokta = zorunlu eğitim
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
