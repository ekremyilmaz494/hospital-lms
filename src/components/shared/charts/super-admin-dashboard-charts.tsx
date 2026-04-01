'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface CustomTooltipProps {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-md)', fontFamily: 'var(--font-mono)' }}>
      <p className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }}>{entry.name}: <strong>{entry.value.toLocaleString('tr-TR')}</strong></p>
      ))}
    </div>
  )
}

const PIE_COLORS = ['var(--color-success)', 'var(--color-info)', 'var(--color-error)', 'var(--color-warning)']

interface MonthlyTrendProps {
  data: { month: string; hastane: number; personel: number }[]
}

export function MonthlyTrendChart({ data }: MonthlyTrendProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="gradHospital" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPersonel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-body)' }} />
        <Area type="monotone" dataKey="hastane" name="Hastane" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#gradHospital)" />
        <Area type="monotone" dataKey="personel" name="Personel" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gradPersonel)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface SubscriptionPieProps {
  data: { name: string; value: number }[]
}

export function SubscriptionPieChart({ data }: SubscriptionPieProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-body)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface SubscriptionBarProps {
  data: { plan: string; aktif: number; trial: number; suresiDoldu: number }[]
}

export function SubscriptionBarChart({ data }: SubscriptionBarProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="plan" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-body)' }} />
        <Bar dataKey="aktif" name="Aktif" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={24} />
        <Bar dataKey="trial" name="Deneme" fill="var(--color-info)" radius={[4, 4, 0, 0]} barSize={24} />
        <Bar dataKey="suresiDoldu" name="Süresi Doldu" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
