'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Grid3X3, TrendingUp, Sparkles } from 'lucide-react';
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

type CellState = 'passed' | 'failed' | 'in_progress' | 'assigned' | 'unassigned';

const cellStyles: Record<CellState, { bg: string; border: string; dot: string; label: string; chipBg: string; chipText: string }> = {
  passed:      { bg: '#d1fae5',  border: '#0d9668', dot: '#0d9668', label: 'Başarılı',  chipBg: 'rgba(16, 185, 129, 0.14)', chipText: '#047857' },
  in_progress: { bg: '#fef3c7',  border: '#b45309', dot: '#f59e0b', label: 'Devam',     chipBg: 'rgba(245, 158, 11, 0.16)', chipText: '#b45309' },
  assigned:    { bg: '#dbeafe',  border: '#1d4ed8', dot: '#3b82f6', label: 'Atandı',    chipBg: 'rgba(59, 130, 246, 0.14)', chipText: '#1d4ed8' },
  failed:      { bg: '#fee2e2',  border: '#b91c1c', dot: '#ef4444', label: 'Başarısız', chipBg: 'rgba(239, 68, 68, 0.16)',  chipText: '#b91c1c' },
  unassigned:  { bg: 'transparent', border: '#d6d3d1', dot: '#a8a29e', label: 'Atanmadı', chipBg: 'rgba(168, 162, 158, 0.18)', chipText: '#78716c' },
};

const nameHue = (name: string) => name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

function getRateTier(rate: number) {
  if (rate >= 80) return { color: K.PRIMARY, accent: '#10b981', label: 'Yüksek' };
  if (rate >= 50) return { color: '#b45309', accent: '#f59e0b', label: 'Orta' };
  if (rate > 0)   return { color: '#b91c1c', accent: '#ef4444', label: 'Düşük' };
  return { color: '#a8a29e', accent: '#d6d3d1', label: '—' };
}

export function MatrixMiniWidget() {
  const { data, isLoading } = useFetch<{ trainings: { id: string; title: string; isCompulsory: boolean }[]; staff: { id: string; name: string; department: string; cells: MiniCell[]; completionRate: number }[] }>('/api/admin/competency-matrix');

  const allTrainings = useMemo(() => data?.trainings ?? [], [data]);
  const allStaff = useMemo(() => data?.staff ?? [], [data]);

  const stats = useMemo(() => {
    const counts: Record<CellState, number> = { passed: 0, failed: 0, in_progress: 0, assigned: 0, unassigned: 0 };
    let totalAssigned = 0;
    for (const s of allStaff) {
      for (const c of s.cells) {
        const state = (c.state in counts ? c.state : 'unassigned') as CellState;
        counts[state] += 1;
        if (state !== 'unassigned') totalAssigned += 1;
      }
    }
    const grid = allStaff.length * allTrainings.length;
    const coverage = grid > 0 ? Math.round((counts.passed / grid) * 100) : 0;
    return { counts, coverage, totalAssigned, grid };
  }, [allStaff, allTrainings]);

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

  const previewTrainings = allTrainings.slice(0, 6);
  const previewStaff = allStaff.slice(0, 8);

  if (previewStaff.length === 0 || previewTrainings.length === 0) return null;

  const preview: MatrixPreview = {
    trainings: previewTrainings,
    staff: previewStaff.map(s => ({
      name: s.name,
      cells: previewTrainings.map(t => s.cells.find(c => c.trainingId === t.id) ?? { trainingId: t.id, state: 'unassigned' }),
    })),
  };

  const isCompactCols = previewTrainings.length <= 4;
  const cellSize = isCompactCols ? 26 : 22;
  const remainingStaff = allStaff.length - previewStaff.length;

  return (
    <div
      className="overflow-hidden"
      style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-start justify-between gap-3 px-5 py-4"
        style={{
          borderBottom: `1px solid ${K.BORDER_LIGHT}`,
          background: K.BG,
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: K.PRIMARY_LIGHT }}
          >
            <Grid3X3 className="h-4 w-4" style={{ color: K.PRIMARY }} />
          </div>
          <div className="min-w-0">
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
              Yetkinlik Matrisi
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <MetaChip val={`${allStaff.length}`} unit="personel" />
              <MetaChip val={`${allTrainings.length}`} unit="eğitim" />
              <MetaChip val={`%${stats.coverage}`} unit="tamamlandı" accent />
            </div>
          </div>
        </div>

        <Link
          href="/admin/competency-matrix"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: K.PRIMARY, color: '#ffffff' }}
        >
          Tümü <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Status Distribution Strip ── */}
      <div
        className="flex flex-wrap items-center gap-2 px-5 py-3"
        style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} style={{ color: K.PRIMARY }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: K.PRIMARY, letterSpacing: '0.06em' }}>
            Dağılım
          </span>
        </div>
        <span className="mx-1 h-3.5 w-px" style={{ background: 'rgba(15, 23, 42, 0.08)' }} />
        <StatusChip state="passed"      count={stats.counts.passed} />
        <StatusChip state="in_progress" count={stats.counts.in_progress} />
        <StatusChip state="assigned"    count={stats.counts.assigned} />
        <StatusChip state="failed"      count={stats.counts.failed} />
        {stats.counts.unassigned > 0 && <StatusChip state="unassigned" count={stats.counts.unassigned} />}
      </div>

      {/* ── Matrix ── */}
      <div className="overflow-x-auto px-5 pb-4 pt-4">
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '34%', paddingBottom: 10, textAlign: 'left' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED }}>
                  Personel
                </span>
              </th>
              {preview.trainings.map((t) => (
                <th
                  key={t.id}
                  style={{
                    paddingBottom: 10,
                    paddingLeft: isCompactCols ? 8 : 3,
                    paddingRight: isCompactCols ? 8 : 3,
                    textAlign: 'center',
                    verticalAlign: 'bottom',
                  }}
                >
                  {isCompactCols ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: t.isCompulsory ? '#b91c1c' : K.TEXT_SECONDARY,
                          background: t.isCompulsory ? 'rgba(239, 68, 68, 0.10)' : K.BG,
                          border: `1px solid ${t.isCompulsory ? 'rgba(239, 68, 68, 0.25)' : K.BORDER_LIGHT}`,
                          maxWidth: 130,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}
                        title={t.title + (t.isCompulsory ? ' (Zorunlu)' : '')}
                      >
                        {t.title.length > 18 ? t.title.slice(0, 18) + '…' : t.title}
                      </span>
                      {t.isCompulsory && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold" style={{ color: '#b91c1c' }}>
                          <Sparkles size={8} />ZORUNLU
                        </span>
                      )}
                    </div>
                  ) : (
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
                          height: 64,
                          lineHeight: 1.25,
                          display: 'block',
                          overflow: 'hidden',
                        }}
                        title={t.title}
                      >
                        {t.title.length > 14 ? t.title.slice(0, 14) + '…' : t.title}
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
                  )}
                </th>
              ))}
              <th style={{ width: 130, paddingBottom: 10, paddingLeft: 14, textAlign: 'left', verticalAlign: 'bottom' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED }}>
                  Tamamlanma
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.staff.map((s, si) => {
              const staffFull = allStaff.find(st => st.name === s.name);
              const rate = staffFull?.completionRate ?? 0;
              const tier = getRateTier(rate);
              const hue = nameHue(s.name);
              return (
                <tr
                  key={s.name}
                  style={{
                    background: si % 2 === 1 ? 'rgba(15, 23, 42, 0.02)' : 'transparent',
                  }}
                >
                  <td style={{ paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, hsl(${hue}, 56%, 56%) 0%, hsl(${(hue + 30) % 360}, 50%, 46%) 100%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800, color: '#fff',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.10)',
                        }}
                      >
                        {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <span
                        style={{
                          fontSize: 12.5, fontWeight: 600,
                          color: K.TEXT_PRIMARY,
                          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={s.name}
                      >
                        {s.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>
                  </td>

                  {s.cells.map((cell, ci) => {
                    const state = (cell.state in cellStyles ? cell.state : 'unassigned') as CellState;
                    const cs = cellStyles[state];
                    const isUnset = state === 'unassigned';
                    return (
                      <td key={ci} style={{ padding: '7px 3px', textAlign: 'center' }}>
                        <div
                          title={cs.label}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: '50%',
                            background: cs.bg,
                            border: `2px ${isUnset ? 'dashed' : 'solid'} ${cs.border}`,
                            margin: '0 auto',
                            cursor: 'default',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {state === 'passed' && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cs.dot }} />
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td style={{ paddingLeft: 14, paddingTop: 7, paddingBottom: 7, borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          minWidth: 50,
                          maxWidth: 90,
                          borderRadius: 999,
                          background: `${tier.accent}1f`,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${rate}%`,
                            borderRadius: 999,
                            background: rate > 0
                              ? `linear-gradient(90deg, ${tier.accent} 0%, ${tier.color} 100%)`
                              : 'transparent',
                            transition: 'width 0.6s ease',
                            boxShadow: rate > 0 ? `0 1px 2px ${tier.accent}40` : 'none',
                          }}
                        />
                      </div>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: tier.color,
                          minWidth: 32,
                          textAlign: 'right',
                        }}
                      >
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

      {/* ── Legend + Footer CTA ── */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3"
        style={{ borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
      >
        {(['passed', 'in_progress', 'assigned', 'failed'] as CellState[]).map((state) => {
          const cs = cellStyles[state];
          return (
            <div key={state} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cs.bg, border: `2px solid ${cs.border}` }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: K.TEXT_SECONDARY }}>{cs.label}</span>
            </div>
          );
        })}

        {remainingStaff > 0 && (
          <Link
            href="/admin/competency-matrix"
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors hover:opacity-80"
            style={{
              background: K.PRIMARY_LIGHT,
              color: K.PRIMARY,
              border: `1px solid ${K.PRIMARY}33`,
            }}
          >
            +{remainingStaff} personel daha
            <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}

function MetaChip({ val, unit, accent = false }: { val: string; unit: string; accent?: boolean }) {
  return (
    <span
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
  );
}

function StatusChip({ state, count }: { state: CellState; count: number }) {
  const cs = cellStyles[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold"
      style={{ background: cs.chipBg, color: cs.chipText }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cs.dot }} />
      {cs.label} <span className="font-mono tabular-nums">·{count}</span>
    </span>
  );
}
