'use client';

import { useState } from 'react';
import { Zap, X, ArrowRight, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AlertBannerProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  variant?: 'info' | 'warning' | 'success' | 'error';
  dismissible?: boolean;
}

const variantConfig = {
  info: {
    bg: 'var(--color-info-bg)',
    border: 'var(--color-info)',
    icon: Info,
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning)',
    icon: AlertTriangle,
  },
  success: {
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success)',
    icon: CheckCircle,
  },
  error: {
    bg: 'var(--color-error-bg)',
    border: 'var(--color-error)',
    icon: Zap,
  },
};

export function AlertBanner({
  message,
  actionLabel,
  actionHref,
  variant = 'info',
  dismissible = true,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-5 py-3.5"
      style={{
        background: config.bg,
        borderLeft: `4px solid ${config.border}`,
        boxShadow: `inset 0 0 0 1px ${config.border}20`,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${config.border}20` }}
      >
        <Icon className="h-4 w-4" style={{ color: config.border }} />
      </div>
      <p
        className="flex-1 text-sm font-medium"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}
      >
        {message}
      </p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{
            background: `${config.border}15`,
            color: config.border,
            transition: 'background var(--transition-fast)',
          }}
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1.5"
          style={{ color: 'var(--color-text-muted)', transition: 'background var(--transition-fast)' }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
