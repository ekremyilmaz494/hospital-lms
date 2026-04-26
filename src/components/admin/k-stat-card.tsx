'use client';

import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** İkon arka plan + ikon renk accenti (örn. var(--k-primary), #f59e0b vb.) */
  accentColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
}

const CARD_BG = '#ffffff';
const CARD_BORDER = '#c9c4be';
const TEXT_PRIMARY = '#1c1917';
const TEXT_MUTED = '#78716c';
const SUCCESS = '#10b981';
const SUCCESS_BG = '#d1fae5';
const ERROR = '#ef4444';
const ERROR_BG = '#fee2e2';

/**
 * Klinova admin paneli için KPI kartı — TAM inline style.
 * globals.css'teki .k-stat-card class'larına bağımlı değil — Tailwind/Turbopack
 * cache problemlerine karşı bağışık.
 */
export function KStatCard({
  title,
  value,
  icon: Icon,
  accentColor = '#0d9668',
  trend,
}: KStatCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: CARD_BG,
        border: `1.5px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: '20px 22px',
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
        overflow: 'hidden',
        transition: 'border-color 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: TEXT_MUTED,
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
            color: accentColor,
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display, system-ui)',
          fontSize: 26,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1.05,
          letterSpacing: '-0.018em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
      </div>
      {trend && (
        <div
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 999,
              fontVariantNumeric: 'tabular-nums',
              background: trend.isPositive ? SUCCESS_BG : ERROR_BG,
              color: trend.isPositive ? SUCCESS : ERROR,
            }}
          >
            {trend.isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
          <span style={{ color: TEXT_MUTED, fontWeight: 500 }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
