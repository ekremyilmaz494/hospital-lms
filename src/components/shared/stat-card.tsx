'use client';

import { type LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  accentColor?: string;
  iconBgColor?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  accentColor = 'var(--color-primary)',
  iconBgColor,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-6',
        className
      )}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {title}
          </p>
          <p
            className="mt-3 text-[2rem] font-bold leading-none tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
          </p>
          {trend && (
            <div className="mt-3 flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: trend.isPositive ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                }}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
                ) : (
                  <TrendingDown className="h-3 w-3" style={{ color: 'var(--color-error)' }} />
                )}
                <span
                  className="text-[11px] font-bold"
                  style={{ color: trend.isPositive ? 'var(--color-success)' : 'var(--color-error)' }}
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {trend.label}
              </span>
            </div>
          )}
        </div>

        {/* Icon — larger, more prominent */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: iconBgColor || `${accentColor}20`,
            border: `1.5px solid ${accentColor}30`,
            boxShadow: `0 4px 12px ${accentColor}15`,
          }}
        >
          <Icon className="h-6 w-6" style={{ color: accentColor }} />
        </div>
      </div>

      {/* Bottom mini sparkline */}
      <div className="mt-4 flex gap-[3px]">
        {[40, 65, 45, 80, 55, 70, 90, 60, 85, 75, 95, 80].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h * 0.24}px`,
              background: accentColor,
              opacity: 0.15 + (i / 12) * 0.25,
            }}
          />
        ))}
      </div>
    </div>
  );
}
