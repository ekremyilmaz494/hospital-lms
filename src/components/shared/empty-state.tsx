import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Veri yoksa gösterilecek minimal empty state.
 * 21stdev'in "EmptyState beautiful" varyantından + PR #21 paletinden türetildi.
 */
export type EmptyStateTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface ToneTokens {
  iconBg: string;
  iconFg: string;
  ring: string;
}

const TONE_TOKENS: Record<EmptyStateTone, ToneTokens> = {
  neutral: { iconBg: '#f1f5f9', iconFg: '#475569', ring: '#e2e8f0' },
  info: { iconBg: '#eef2fb', iconFg: '#1f3a7a', ring: '#dfe6f5' },
  success: { iconBg: '#eaf6ef', iconFg: '#0a7a47', ring: '#cde8d8' },
  warning: { iconBg: '#fef6e7', iconFg: '#6a4e11', ring: '#f3e6c2' },
  error: { iconBg: '#fdf5f2', iconFg: '#8a1a15', ring: '#f4d6d1' },
};

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Ana aksiyon (primary CTA) */
  action?: EmptyStateAction;
  /** İkincil aksiyon */
  secondaryAction?: EmptyStateAction;
  /** İkon dairesinin renk tonu */
  tone?: EmptyStateTone;
  /** Çerçeve tipi — 'dashed' tipik empty-state, 'plain' kart içinde iç empty için */
  border?: 'dashed' | 'plain' | 'none';
  /** Boyut ayarı */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: 'primary' | 'secondary' }) {
  const { label, onClick, href, icon: Icon } = action;
  const isPrimary = variant === 'primary';

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span>{label}</span>
    </>
  );

  const styles: React.CSSProperties = isPrimary
    ? { backgroundColor: '#0d2010', color: '#ffffff' }
    : { backgroundColor: '#ffffff', color: '#334155', border: '1px solid #e2e8f0' };

  const className = cn(
    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm',
    'transition-colors',
    isPrimary ? 'hover:brightness-110' : 'hover:bg-slate-50',
  );

  if (href) {
    return (
      <a href={href} className={className} style={styles}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={styles}>
      {content}
    </button>
  );
}

/**
 * @example
 * <EmptyState
 *   icon={Inbox}
 *   title="Bekleyen değerlendirmen yok"
 *   description="Yeni değerlendirmeler geldiğinde burada listelenir."
 *   action={{ label: "Takvime git", href: "/staff/calendar" }}
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tone = 'neutral',
  border = 'dashed',
  size = 'md',
  className,
}: EmptyStateProps) {
  const tokens = TONE_TOKENS[tone];

  const sizeMap = {
    sm: { padding: 'p-6', iconBox: 'h-12 w-12', iconSize: 'h-5 w-5', title: 'text-base', desc: 'text-[13px]' },
    md: { padding: 'p-8', iconBox: 'h-14 w-14', iconSize: 'h-6 w-6', title: 'text-lg', desc: 'text-sm' },
    lg: { padding: 'p-12', iconBox: 'h-16 w-16', iconSize: 'h-7 w-7', title: 'text-xl', desc: 'text-[15px]' },
  }[size];

  const borderStyles: React.CSSProperties =
    border === 'dashed'
      ? { border: '1.5px dashed #cbd5e1', backgroundColor: '#fafbfc' }
      : border === 'plain'
      ? { border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }
      : {};

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl',
        sizeMap.padding,
        className,
      )}
      style={borderStyles}
      role="status"
      aria-live="polite"
    >
      {/* Icon circle */}
      <div
        className={cn('flex items-center justify-center rounded-2xl', sizeMap.iconBox)}
        style={{
          backgroundColor: tokens.iconBg,
          boxShadow: `inset 0 0 0 1px ${tokens.ring}`,
        }}
      >
        <Icon
          className={sizeMap.iconSize}
          style={{ color: tokens.iconFg }}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3
        className={cn('mt-4 font-semibold tracking-tight', sizeMap.title)}
        style={{ color: '#0f172a' }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn('mt-1.5 max-w-md leading-relaxed', sizeMap.desc)}
          style={{ color: '#64748b' }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  );
}
