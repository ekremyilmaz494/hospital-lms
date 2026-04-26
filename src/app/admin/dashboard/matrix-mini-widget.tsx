'use client';

import Link from 'next/link';
import { ArrowRight, Grid3X3 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface MiniCell { trainingId: string; state: string }
interface MiniStaffRow { name: string; cells: MiniCell[] }
interface MatrixPreview { trainings: { id: string; title: string; isCompulsory?: boolean }[]; staff: MiniStaffRow[] }

const cellStyles: Record<string, { bg: string; border: string; label: string }> = {
  passed:      { bg: K.SUCCESS_BG, border: K.PRIMARY,  label: 'Başarılı' },
  failed:      { bg: K.ERROR_BG,   border: '#b91c1c',  label: 'Başarısız' },
  in_progress: { bg: K.WARNING_BG, border: '#b45309',  label: 'Devam' },
  assigned:    { bg: K.INFO_BG,    border: '#1d4ed8',  label: 'Atandı' },
  unassigned:  { bg: 'transparent',border: K.BORDER,   label: 'Atanmadı' },
};

const nameHue = (name: string) => name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

export function MatrixMiniWidget() {
  const { data, isLoading } = useFetch<{ trainings: { id: string; title: string; isCompulsory: boolean }[]; staff: { id: string; name: string; department: string; cells: MiniCell[]; completionRate: number }[] }>('/api/admin/competency-matrix');

  if (isLoading) {
    return (
      <div
        className="animate-pulse overflow-hidden"
        style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
          <div className="h-9 w-9 rounded-xl" style={{ background: K.BORDER_LIGHT }} />
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded" style={{ background: K.BORDER_LIGHT }} />
            <div className="h-2.5 w-44 rounded" style={{ background: K.BORDER_LIGHT }} />
          </div>
        </div>
        <div className="space-y-2.5 p-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full" style={{ background: K.BORDER_LIGHT }} />
              <div className="h-2.5 w-20 rounded" style={{ background: K.BORDER_LIGHT }} />
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-6 w-6 rounded-full" style={{ background: K.BORDER_LIGHT }} />
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
    <div
      className="overflow-hidden"
      style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
    >

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: `1px solid ${K.BORDER_LIGHT}`,
          background: K.BG,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: K.PRIMARY_LIGHT,
            }}
          >
            <Grid3X3 className="h-4 w-4" style={{ color: K.PRIMARY }} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, letterSpacing: '-0.01em' }}>Yetkinlik Matrisi</h3>
            <div className="mt-1 flex items-center gap-1.5">
              {[
                { val: `${allStaff.length}`, unit: 'personel', accent: false },
                { val: `${allTrainings.length}`, unit: 'eğitim', accent: false },
                { val: `%${coverageRate}`, unit: 'tamamlandı', accent: true },
              ].map(({ val, unit, accent }) => (
                <span
                  key={unit}
                  className="inline-flex items-center gap-1 rounded-full"
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    background: accent ? K.SUCCESS_BG : K.SURFACE,
                    border: `1px solid ${accent ? K.PRIMARY : K.BORDER_LIGHT}`,
                    color: accent ? K.PRIMARY : K.TEXT_MUTED,
                  }}
                >
                  <strong style={{ color: accent ? K.PRIMARY : K.TEXT_SECONDARY, fontWeight: 700 }}>{val}</strong>
                  {unit}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/admin/competency-matrix"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: K.PRIMARY, color: '#ffffff' }}
        >
          Tümü <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Matrix ── */}
      <div className="overflow-x-auto px-5 pb-4 pt-4">
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 130, paddingBottom: 6 }} />
              {preview.trainings.map((t) => (
                <th key={t.id} style={{ paddingBottom: 6, paddingLeft: 3, paddingRight: 3, textAlign: 'center', verticalAlign: 'bottom' }}>
                  <div className="flex flex-col items-center gap-1">
                    <span
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: K.TEXT_MUTED,
                        letterSpacing: '0.05em',
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
                        background: t.isCompulsory ? K.ERROR : K.INFO,
                        flexShrink: 0,
                      }}
                      title={t.isCompulsory ? 'Zorunlu eğitim' : undefined}
                    />
                  </div>
                </th>
              ))}
              <th style={{ width: 80, paddingBottom: 6, paddingLeft: 10, textAlign: 'left', verticalAlign: 'bottom' }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: K.TEXT_MUTED }}>ORAN</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.staff.map((s, si) => {
              const staffFull = allStaff.find(st => st.name === s.name);
              const rate = staffFull?.completionRate ?? 0;
              const rateColor = rate >= 80 ? K.PRIMARY : rate >= 50 ? '#b45309' : '#b91c1c';
              const hue = nameHue(s.name);
              return (
                <tr key={s.name} style={{ borderTop: si > 0 ? `1px solid ${K.BORDER_LIGHT}` : 'none' }}>
                  <td style={{ paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${hue}, 52%, 52%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: '#fff',
                        }}
                      >
                        {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: K.TEXT_PRIMARY,
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
                            cursor: 'default',
                          }}
                        />
                      </td>
                    );
                  })}

                  <td style={{ paddingLeft: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 38, height: 5, borderRadius: 3, background: K.BORDER_LIGHT, overflow: 'hidden', flexShrink: 0 }}>
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
        style={{ borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
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
              <span style={{ fontSize: 11, fontWeight: 500, color: K.TEXT_MUTED }}>{label}</span>
            </div>
          );
        })}
        {allStaff.length > 8 && (
          <span className="ml-auto text-[11px]" style={{ color: K.TEXT_MUTED }}>
            +{allStaff.length - 8} personel daha
          </span>
        )}
      </div>
    </div>
  );
}
