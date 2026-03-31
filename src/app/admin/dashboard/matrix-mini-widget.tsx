'use client';

import Link from 'next/link';
import { ArrowRight, Grid3X3 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface MiniCell { trainingId: string; state: string }
interface MiniStaffRow { name: string; cells: MiniCell[] }
interface MatrixPreview { trainings: { id: string; title: string; isCompulsory?: boolean }[]; staff: MiniStaffRow[] }

const cellStyles: Record<string, { bg: string; border: string; label: string }> = {
  passed:      { bg: 'var(--color-success-bg)',  border: 'var(--color-success)',  label: 'Başarılı' },
  failed:      { bg: 'var(--color-error-bg)',    border: 'var(--color-error)',    label: 'Başarısız' },
  in_progress: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', label: 'Devam' },
  assigned:    { bg: 'var(--color-info-bg)',     border: 'var(--color-info)',     label: 'Atandı' },
  unassigned:  { bg: 'transparent',              border: 'var(--color-border)',   label: 'Atanmadı' },
};

const nameHue = (name: string) => name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

export function MatrixMiniWidget() {
  const { data, isLoading } = useFetch<{ trainings: { id: string; title: string; isCompulsory: boolean }[]; staff: { id: string; name: string; department: string; cells: MiniCell[]; completionRate: number }[] }>('/api/admin/competency-matrix');

  if (isLoading) {
    return (
      <div className="animate-pulse overflow-hidden rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-border)' }} />
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded" style={{ background: 'var(--color-border)' }} />
            <div className="h-2.5 w-44 rounded" style={{ background: 'var(--color-border)' }} />
          </div>
        </div>
        <div className="space-y-2.5 p-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full" style={{ background: 'var(--color-border)' }} />
              <div className="h-2.5 w-20 rounded" style={{ background: 'var(--color-border)' }} />
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-6 w-6 rounded-full" style={{ background: 'var(--color-border)' }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allTrainings = data?.trainings ?? [];
  const allStaff = data?.staff ?? [];
  const previewTrainings = allTrainings.slice(0, 6);
  const previewStaff = allStaff.slice(0, 8);

  if (previewStaff.length === 0 || previewTrainings.length === 0) return null;

  const totalCells = allStaff.length * allTrainings.length;
  const passedCells = allStaff.flatMap(s => s.cells).filter(c => c.state === 'passed').length;
  const coverageRate = totalCells > 0 ? Math.round((passedCells / totalCells) * 100) : 0;

  const preview: MatrixPreview = {
    trainings: previewTrainings,
    staff: previewStaff.map(s => ({
      name: s.name,
      cells: previewTrainings.map(t => s.cells.find(c => c.trainingId === t.id) ?? { trainingId: t.id, state: 'unassigned' }),
    })),
  };

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, transparent 70%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-light) 0%, rgba(59,130,246,0.12) 100%)',
              boxShadow: '0 1px 4px rgba(59,130,246,0.18)',
            }}
          >
            <Grid3X3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Yetkinlik Matrisi</h3>
            <div className="mt-1 flex items-center gap-1.5">
              {[
                { val: `${allStaff.length}`, unit: 'personel', accent: false },
                { val: `${allTrainings.length}`, unit: 'eğitim', accent: false },
                { val: `%${coverageRate}`, unit: 'tamamlandı', accent: true },
              ].map(({ val, unit, accent }) => (
                <span
                  key={unit}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: accent ? 'var(--color-success-bg)' : 'var(--color-bg)',
                    border: `1px solid ${accent ? 'var(--color-success)' : 'var(--color-border)'}`,
                    color: accent ? 'var(--color-success)' : 'var(--color-text-muted)',
                    opacity: accent ? 1 : 0.85,
                  }}
                >
                  <strong style={{ color: accent ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 700 }}>{val}</strong>
                  {unit}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/admin/competency-matrix"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
        >
          Tümü <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Matrix ── */}
      <div className="overflow-x-auto px-5 pb-4 pt-4">
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ width: 116, paddingBottom: 6 }} />
              {preview.trainings.map((t) => (
                <th key={t.id} style={{ width: 34, paddingBottom: 6, paddingLeft: 3, paddingRight: 3, textAlign: 'center', verticalAlign: 'bottom' }}>
                  <div className="flex flex-col items-center gap-1">
                    <span
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '0.03em',
                        height: 54,
                        lineHeight: 1.25,
                        display: 'block',
                        overflow: 'hidden',
                      }}
                      title={t.title}
                    >
                      {t.title.length > 13 ? t.title.slice(0, 13) + '…' : t.title}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        width: 5, height: 5, borderRadius: '50%',
                        background: t.isCompulsory ? 'var(--color-error)' : 'var(--color-info)',
                        flexShrink: 0,
                      }}
                      title={t.isCompulsory ? 'Zorunlu eğitim' : undefined}
                    />
                  </div>
                </th>
              ))}
              <th style={{ width: 64, paddingBottom: 6, paddingLeft: 10, textAlign: 'left', verticalAlign: 'bottom' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>ORAN</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.staff.map((s, si) => {
              const staffFull = allStaff.find(st => st.name === s.name);
              const rate = staffFull?.completionRate ?? 0;
              const rateColor = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
              const hue = nameHue(s.name);
              return (
                <tr key={s.name} style={{ borderTop: si > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${hue}, 52%, 52%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: '#fff',
                          boxShadow: `0 1px 4px hsl(${hue}, 52%, 52%, 0.4)`,
                        }}
                      >
                        {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={s.name}
                      >
                        {s.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>
                  </td>

                  {s.cells.map((cell, ci) => {
                    const cs = cellStyles[cell.state] ?? cellStyles.unassigned;
                    const isUnset = cell.state === 'unassigned';
                    return (
                      <td key={ci} style={{ padding: '6px 3px', textAlign: 'center' }}>
                        <div
                          title={cs.label}
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: cs.bg,
                            border: `2px solid ${cs.border}`,
                            opacity: isUnset ? 0.35 : 1,
                            margin: '0 auto',
                            boxShadow: isUnset ? 'none' : `0 1px 4px rgba(0,0,0,0.08)`,
                            cursor: 'default',
                          }}
                        />
                      </td>
                    );
                  })}

                  <td style={{ paddingLeft: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${rate}%`, borderRadius: 3, background: rateColor, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rateColor, minWidth: 28 }}>
                        %{rate}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
      >
        {[
          { state: 'passed',      label: 'Başarılı' },
          { state: 'in_progress', label: 'Devam' },
          { state: 'assigned',    label: 'Atandı' },
          { state: 'failed',      label: 'Başarısız' },
        ].map(({ state, label }) => {
          const cs = cellStyles[state];
          return (
            <div key={state} className="flex items-center gap-1.5">
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: cs.bg, border: `2px solid ${cs.border}` }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          );
        })}
        {allStaff.length > 8 && (
          <span className="ml-auto text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            +{allStaff.length - 8} personel daha
          </span>
        )}
      </div>
    </div>
  );
}
