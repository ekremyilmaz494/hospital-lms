'use client';

import { type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface ChartCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, icon, action, children, className }: ChartCardProps) {
  return (
    <div
      className={`rounded-2xl border p-6 ${className || ''}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary-light)' }}
            >
              {icon}
            </div>
          )}
          <h3
            className="text-[15px] font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            className="rounded-lg p-2 hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-muted)', transition: 'background var(--transition-fast)' }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
