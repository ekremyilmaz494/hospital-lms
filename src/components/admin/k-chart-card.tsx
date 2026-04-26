'use client';

import type { ReactNode } from 'react';

interface KChartCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

const CARD_BG = '#ffffff';
const CARD_BORDER = '#c9c4be';
const TEXT_PRIMARY = '#1c1917';
const PRIMARY = '#0d9668';

/**
 * Klinova admin paneli için chart wrapper — TAM inline style.
 * Recharts/dynamic chart'ları içeride değiştirmeden, dış shell'i tutarlı yapar.
 */
export function KChartCard({ title, icon, action, children, className }: KChartCardProps) {
  return (
    <div
      className={className}
      style={{
        background: CARD_BG,
        border: `1.5px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 22,
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            fontFamily: 'var(--font-display, system-ui)',
          }}
        >
          {icon && (
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, #0d9668 14%, transparent)',
                color: PRIMARY,
              }}
            >
              {icon}
            </span>
          )}
          <span>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
