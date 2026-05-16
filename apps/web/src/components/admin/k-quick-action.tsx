'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';

interface KQuickActionProps {
  href: string;
  label: string;
  desc?: string;
  icon: LucideIcon;
  /** Sağ taraftaki ikon arka plan + ikon rengi (örn. var(--k-primary), #f59e0b) */
  color?: string;
}

const CARD_BG = '#ffffff';
const CARD_BORDER = '#c9c4be';
const TEXT_PRIMARY = '#1c1917';
const TEXT_MUTED = '#78716c';

/**
 * Klinova admin dashboard quick action tile — TAM inline style.
 */
export function KQuickAction({ href, label, desc, icon: Icon, color = '#0d9668' }: KQuickActionProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: CARD_BG,
        border: `1.5px solid ${CARD_BORDER}`,
        borderRadius: 14,
        textDecoration: 'none',
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
        transition: 'border-color 200ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = CARD_BORDER;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color,
        }}
      >
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontSize: 11.5,
              color: TEXT_MUTED,
              lineHeight: 1.3,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {desc}
          </div>
        )}
      </div>
    </Link>
  );
}
