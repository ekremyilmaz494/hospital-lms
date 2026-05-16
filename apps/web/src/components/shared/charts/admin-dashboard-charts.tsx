'use client'

import React, { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Award, Minus, TrendingUp } from 'lucide-react'

const chartTooltipStyle: React.CSSProperties = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: '12px',
  fontSize: '12px',
  padding: '10px 14px',
  boxShadow: 'var(--shadow-lg)',
  color: 'var(--color-text-primary)',
}

const chartLegendStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-secondary)',
}

interface TrendChartProps {
  data: { month: string; tamamlanan: number; atanan: number; basarisiz: number }[]
}

export const TrendChart = React.memo(function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="gTamamlanan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-secondary)' }} />
        <Legend wrapperStyle={chartLegendStyle} />
        <Area type="monotone" dataKey="tamamlanan" name="Tamamlanan" stroke="var(--color-success)" fill="url(#gTamamlanan)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-success)', strokeWidth: 2, stroke: 'var(--color-surface)' }} />
        <Area type="monotone" dataKey="atanan" name="Atanan" stroke="var(--color-info)" fill="transparent" strokeWidth={1.5} strokeDasharray="5 5" />
        <Bar dataKey="basarisiz" name="Başarısız" fill="var(--color-error)" radius={[3, 3, 0, 0]} barSize={14} opacity={0.8} />
      </AreaChart>
    </ResponsiveContainer>
  )
})

interface StatusDonutProps {
  data: { name: string; value: number; color: string }[]
  total: number
}

export const StatusDonut = React.memo(function StatusDonut({ data, total }: StatusDonutProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-secondary)' }} formatter={(value: unknown, name: unknown) => [`${Number(value)} (${total > 0 ? Math.round(Number(value) / total * 100) : 0}%)`, String(name)]} />
      </PieChart>
    </ResponsiveContainer>
  )
})

interface DepartmentBarProps {
  data: { dept: string; oran: number; puan: number }[]
}

type PerfTier = 'high' | 'mid' | 'low' | 'empty'

const TIER_TOKENS: Record<PerfTier, { accent: string; soft: string; track: string; label: string; chipBg: string; chipText: string }> = {
  high: {
    accent: '#10b981',
    soft: 'rgba(16, 185, 129, 0.10)',
    track: 'rgba(16, 185, 129, 0.12)',
    label: 'Yüksek performans',
    chipBg: 'rgba(16, 185, 129, 0.14)',
    chipText: '#047857',
  },
  mid: {
    accent: '#f59e0b',
    soft: 'rgba(245, 158, 11, 0.10)',
    track: 'rgba(245, 158, 11, 0.14)',
    label: 'Orta seviye',
    chipBg: 'rgba(245, 158, 11, 0.16)',
    chipText: '#b45309',
  },
  low: {
    accent: '#ef4444',
    soft: 'rgba(239, 68, 68, 0.10)',
    track: 'rgba(239, 68, 68, 0.14)',
    label: 'Gelişim gerekli',
    chipBg: 'rgba(239, 68, 68, 0.16)',
    chipText: '#b91c1c',
  },
  empty: {
    accent: '#a8a29e',
    soft: 'rgba(168, 162, 158, 0.08)',
    track: 'rgba(168, 162, 158, 0.18)',
    label: 'Atama bekliyor',
    chipBg: 'rgba(168, 162, 158, 0.18)',
    chipText: '#78716c',
  },
}

function getTier(oran: number): PerfTier {
  if (oran <= 0) return 'empty'
  if (oran >= 80) return 'high'
  if (oran >= 50) return 'mid'
  return 'low'
}

export const DepartmentBar = React.memo(function DepartmentBar({ data }: DepartmentBarProps) {
  const { sorted, summary, average } = useMemo(() => {
    const active = data
      .filter((d) => d.oran > 0)
      .sort((a, b) => b.oran - a.oran || b.puan - a.puan)
    const inactive = data.filter((d) => d.oran <= 0)

    const counts = { high: 0, mid: 0, low: 0, empty: inactive.length }
    let activeSum = 0
    for (const d of active) {
      const tier = getTier(d.oran)
      if (tier !== 'empty') counts[tier] += 1
      activeSum += d.oran
    }
    const avg = active.length > 0 ? Math.round(activeSum / active.length) : 0

    return {
      sorted: [...active, ...inactive],
      summary: counts,
      average: avg,
    }
  }, [data])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {/* Dağılım özeti — sticky strip */}
      <div
        className="mb-4 flex shrink-0 flex-wrap items-center gap-2 rounded-xl px-3 py-2.5"
        style={{
          background: 'color-mix(in srgb, var(--color-primary, #0d9668) 5%, transparent)',
          border: '1px dashed color-mix(in srgb, var(--color-primary, #0d9668) 22%, transparent)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} style={{ color: '#0d9668' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0d9668' }}>
            Ortalama
          </span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: '#0f172a' }}>
            %{average}
          </span>
        </div>
        <div className="mx-1 h-3.5 w-px" style={{ background: 'rgba(15, 23, 42, 0.08)' }} />
        <DistributionDot tier="high" count={summary.high} />
        <DistributionDot tier="mid" count={summary.mid} />
        <DistributionDot tier="low" count={summary.low} />
        {summary.empty > 0 && <DistributionDot tier="empty" count={summary.empty} />}
      </div>

      {/* Departman listesi */}
      <div
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d6d3d1 transparent' }}
      >
        {sorted.map((d, idx) => {
          const tier = getTier(d.oran)
          const tokens = TIER_TOKENS[tier]
          const widthPct = Math.max(0, Math.min(100, d.oran))
          const isLeader = idx === 0 && tier !== 'empty' && d.oran >= 50

          return (
            <div
              key={d.dept}
              className="group relative grid items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
              style={{
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.soft
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Sol accent stripe (sıralama göstergesi) */}
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                style={{
                  width: 3,
                  height: tier === 'empty' ? 14 : 22,
                  background: tokens.accent,
                  opacity: tier === 'empty' ? 0.4 : 1,
                }}
              />

              <div className="min-w-0 pl-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  {isLeader && (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ background: tokens.accent }}
                      aria-label="En yüksek performans"
                    >
                      <Award size={9} strokeWidth={3} color="#fff" />
                    </span>
                  )}
                  <span
                    className="truncate text-xs font-semibold uppercase tracking-wide"
                    title={d.dept}
                    style={{ color: tier === 'empty' ? '#a8a29e' : '#1c1917', letterSpacing: '0.04em' }}
                  >
                    {d.dept}
                  </span>
                </div>

                {/* Bar */}
                <div
                  className="relative h-2 w-full overflow-hidden rounded-full"
                  style={{ background: tokens.track }}
                  role="progressbar"
                  aria-valuenow={d.oran}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${d.dept} tamamlanma oranı`}
                >
                  {tier !== 'empty' && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: tier === 'high'
                          ? `linear-gradient(90deg, ${tokens.accent} 0%, #34d399 100%)`
                          : tier === 'mid'
                          ? `linear-gradient(90deg, ${tokens.accent} 0%, #fbbf24 100%)`
                          : `linear-gradient(90deg, ${tokens.accent} 0%, #f87171 100%)`,
                        boxShadow: `0 1px 2px ${tokens.accent}40`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Sağ: metrikler */}
              <div className="flex shrink-0 items-center gap-2.5">
                {tier === 'empty' ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: tokens.chipBg, color: tokens.chipText }}
                  >
                    <Minus size={10} strokeWidth={3} />
                    Atama yok
                  </span>
                ) : (
                  <>
                    <div className="text-right leading-tight">
                      <div className="font-mono text-sm font-bold tabular-nums" style={{ color: '#0f172a' }}>
                        %{d.oran}
                      </div>
                      <div className="text-[10px] font-medium" style={{ color: '#78716c' }}>
                        ort. {d.puan} puan
                      </div>
                    </div>
                    <span
                      className="hidden h-1.5 w-1.5 shrink-0 rounded-full sm:inline-block"
                      style={{ background: tokens.accent }}
                      title={tokens.label}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

function DistributionDot({ tier, count }: { tier: PerfTier; count: number }) {
  const t = TIER_TOKENS[tier]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold"
      style={{ background: t.chipBg, color: t.chipText }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.accent }} />
      {t.label} <span className="font-mono tabular-nums">·{count}</span>
    </span>
  )
}
