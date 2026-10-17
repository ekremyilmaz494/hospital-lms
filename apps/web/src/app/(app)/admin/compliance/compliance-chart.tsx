'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

interface Props {
  data: { dept: string; rate: number }[];
}

const tooltipStyle = { background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: '12px', fontSize: '12px' };

export default function ComplianceChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-sm py-8 text-center" style={{ color: K.TEXT_MUTED }}>Departman verisi yok</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} unit="%" />
          <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} width={80} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="rate" name="Uyum %" fill={K.PRIMARY} radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
