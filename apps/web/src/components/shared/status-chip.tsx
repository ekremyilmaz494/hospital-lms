import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Personel paneli semantic status chip — PR #21 tasarım dilinden türetildi.
 * Variant'lar hem iş domain'i (assigned/in_progress/passed/failed/locked)
 * hem de generic semantic (info/warning/success/error) isimleriyle.
 */
export type StatusChipVariant =
  | 'assigned'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'locked'
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'neutral';

interface VariantTokens {
  bg: string;
  text: string;
  dot: string;
  ring: string;
}

const VARIANT_TOKENS: Record<StatusChipVariant, VariantTokens> = {
  assigned: { bg: '#eef2fb', text: '#1f3a7a', dot: '#2c55b8', ring: '#2c55b820' },
  info: { bg: '#eef2fb', text: '#1f3a7a', dot: '#2c55b8', ring: '#2c55b820' },

  in_progress: { bg: '#fef6e7', text: '#6a4e11', dot: '#b4820b', ring: '#b4820b20' },
  warning: { bg: '#fef6e7', text: '#6a4e11', dot: '#b4820b', ring: '#b4820b20' },

  passed: { bg: '#eaf6ef', text: '#0a7a47', dot: '#0a7a47', ring: '#0a7a4720' },
  success: { bg: '#eaf6ef', text: '#0a7a47', dot: '#0a7a47', ring: '#0a7a4720' },

  failed: { bg: '#fdf5f2', text: '#b3261e', dot: '#b3261e', ring: '#b3261e20' },
  error: { bg: '#fdf5f2', text: '#b3261e', dot: '#b3261e', ring: '#b3261e20' },

  locked: { bg: '#f4efdf', text: '#8a5a11', dot: '#b4820b', ring: '#8a5a1120' },
  neutral: { bg: '#f1f5f9', text: '#475569', dot: '#64748b', ring: '#64748b20' },
};

export interface StatusChipProps {
  /** Durum varyantı — renk ve semantik belirler */
  variant: StatusChipVariant;
  /** Chip üzerinde görünen metin */
  label: string;
  /** Nokta göstergesini gizle (true ise dot yerine icon veya yalnız text) */
  hideDot?: boolean;
  /** Nokta yerine küçük icon */
  icon?: LucideIcon;
  /** Boyut — tablo/kart içinde 'sm', stand-alone kullanımda 'md' */
  size?: 'sm' | 'md';
  /** Ekstra class */
  className?: string;
}

/**
 * Tinted background + dot indicator + text formatında status badge.
 *
 * @example
 * <StatusChip variant="passed" label="Başarılı" />
 * <StatusChip variant="in_progress" label="Devam Ediyor" icon={Clock} />
 */
export function StatusChip({
  variant,
  label,
  hideDot = false,
  icon: Icon,
  size = 'md',
  className,
}: StatusChipProps) {
  const tokens = VARIANT_TOKENS[variant];
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        isSm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.text,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}`,
      }}
    >
      {Icon ? (
        <Icon
          className={isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'}
          style={{ color: tokens.dot }}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      ) : !hideDot ? (
        <span
          className={cn('rounded-full shrink-0', isSm ? 'h-1.5 w-1.5' : 'h-2 w-2')}
          style={{ backgroundColor: tokens.dot }}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
