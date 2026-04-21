'use client';

import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sol rail + icon-square + başlık + açıklama bannerı.
 * PR #21 training-detail bannerından türetildi; dismiss + action slot eklendi.
 */
export type SectionBannerVariant = 'info' | 'warning' | 'error' | 'success' | 'neutral';

interface VariantTokens {
  rail: string;
  iconBg: string;
  iconFg: string;
  surface: string;
  title: string;
  body: string;
  border: string;
}

const VARIANT_TOKENS: Record<SectionBannerVariant, VariantTokens> = {
  info: {
    rail: '#2c55b8',
    iconBg: '#eef2fb',
    iconFg: '#1f3a7a',
    surface: '#f7f9ff',
    title: '#1f3a7a',
    body: '#3b4a70',
    border: '#dfe6f5',
  },
  warning: {
    rail: '#b4820b',
    iconBg: '#fef6e7',
    iconFg: '#6a4e11',
    surface: '#fffbf0',
    title: '#6a4e11',
    body: '#6b5628',
    border: '#f3e6c2',
  },
  error: {
    rail: '#b3261e',
    iconBg: '#fdf5f2',
    iconFg: '#8a1a15',
    surface: '#fff8f6',
    title: '#8a1a15',
    body: '#6e2a27',
    border: '#f4d6d1',
  },
  success: {
    rail: '#0a7a47',
    iconBg: '#eaf6ef',
    iconFg: '#0a7a47',
    surface: '#f3faf5',
    title: '#0a7a47',
    body: '#2f5a45',
    border: '#cde8d8',
  },
  neutral: {
    rail: '#64748b',
    iconBg: '#f1f5f9',
    iconFg: '#334155',
    surface: '#f8fafc',
    title: '#1e293b',
    body: '#475569',
    border: '#e2e8f0',
  },
};

export interface SectionBannerProps {
  variant?: SectionBannerVariant;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Sağ tarafa gelen CTA veya ek içerik (ör. buton) */
  action?: ReactNode;
  /** Dismiss butonu göster (kapatma ikonu) */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

/**
 * @example
 * <SectionBanner
 *   variant="warning"
 *   icon={AlertTriangle}
 *   title="Son 3 gün"
 *   description="Eğitimi tamamlamak için süreniz azaldı."
 * />
 */
export function SectionBanner({
  variant = 'info',
  icon: Icon,
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className,
}: SectionBannerProps) {
  const [visible, setVisible] = useState(true);
  const tokens = VARIANT_TOKENS[variant];

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={cn(
        'relative flex items-start gap-3 overflow-hidden rounded-2xl p-4 pl-5',
        className,
      )}
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
      }}
    >
      {/* Sol 3px rail */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: tokens.rail }}
      />

      {/* Icon square */}
      {Icon && (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: tokens.iconBg }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: tokens.iconFg }} strokeWidth={2} />
        </span>
      )}

      {/* Metin */}
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-semibold leading-5 tracking-tight"
          style={{ color: tokens.title }}
        >
          {title}
        </div>
        {description && (
          <div
            className="mt-1 text-[13px] leading-5"
            style={{ color: tokens.body }}
          >
            {description}
          </div>
        )}
      </div>

      {/* Sağ action slot */}
      {action && <div className="shrink-0 self-center">{action}</div>}

      {/* Dismiss */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Kapat"
          className="shrink-0 self-start rounded-md p-1 transition-colors hover:bg-black/5"
          style={{ color: tokens.body }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
