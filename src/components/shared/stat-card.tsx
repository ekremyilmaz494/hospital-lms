'use client';

import { type LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NumberTicker } from '@/components/ui/number-ticker';

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
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const isNumeric = !isNaN(numericValue) && typeof value === 'number';
  const hasDecimal = typeof value === 'string' && value.includes('.');

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-6 clickable-card',
        className
      )}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60)` }}
      />

      {/* Subtle gradient overlay on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 80% 20%, ${accentColor}08 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {title}
          </p>
          <div className="mt-3 text-[1.85rem] font-bold leading-none tracking-tight font-heading">
            {isNumeric ? (
              <NumberTicker
                value={numericValue}
                className="font-heading font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              />
            ) : hasDecimal ? (
              <NumberTicker
                value={parseFloat(value as string)}
                decimalPlaces={1}
                className="font-heading font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              />
            ) : (
              <span>{value}</span>
            )}
          </div>
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

        {/* Premium Icon Container */}
        <div className="relative shrink-0">
          {/* Outer glow ring */}
          <div
            className="absolute -inset-1.5 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `conic-gradient(from 180deg, ${accentColor}00, ${accentColor}30, ${accentColor}00)`,
              filter: 'blur(4px)',
            }}
          />
          {/* Decorative dot grid behind icon */}
          <div
            className="absolute inset-0 rounded-xl opacity-40"
            style={{
              backgroundImage: `radial-gradient(${accentColor}30 1px, transparent 1px)`,
              backgroundSize: '6px 6px',
            }}
          />
          {/* Main icon container */}
          <div
            className="relative flex h-13 w-13 items-center justify-center rounded-xl transition-transform duration-400 group-hover:scale-110 group-hover:rotate-3"
            style={{
              background: `linear-gradient(145deg, ${accentColor}18, ${accentColor}08)`,
              border: `1.5px solid ${accentColor}25`,
              boxShadow: `0 4px 14px ${accentColor}12, inset 0 1px 1px ${accentColor}10`,
            }}
          >
            {/* Inner gradient orb */}
            <div
              className="absolute inset-1.5 rounded-lg"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${accentColor}15, transparent 70%)`,
              }}
            />
            <Icon
              className="relative h-6 w-6"
              style={{
                color: accentColor,
                filter: `drop-shadow(0 1px 2px ${accentColor}40)`,
              }}
              strokeWidth={1.8}
            />
          </div>
        </div>
      </div>

      {/* Mini sparkline */}
      <div className="mt-4 flex gap-[3px]">
        {[40, 65, 45, 80, 55, 70, 90, 60, 85, 75, 95, 80].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300 group-hover:opacity-100"
            style={{
              height: `${h * 0.2}px`,
              background: accentColor,
              opacity: 0.1 + (i / 12) * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
