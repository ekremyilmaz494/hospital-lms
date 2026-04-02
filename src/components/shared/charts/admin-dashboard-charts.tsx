'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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

export function TrendChart({ data }: TrendChartProps) {
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
}

interface StatusDonutProps {
  data: { name: string; value: number; color: string }[]
  total: number
}

export function StatusDonut({ data, total }: StatusDonutProps) {
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
}

interface DepartmentBarProps {
  data: { dept: string; oran: number; puan: number }[]
}

export function DepartmentBar({ data }: DepartmentBarProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
        <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={80} />
        <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-secondary)' }} />
        <Bar dataKey="oran" name="Tamamlanma %" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}
