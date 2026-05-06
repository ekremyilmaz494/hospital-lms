/**
 * White-on-cream hairline kart — editorial sistemin temel container'ı.
 * 1px rule border, 4px radius, **shadow yok**. Opsiyonel 4px sol-bar
 * ile semantic tone (danger/warning/info/success).
 */
import type { CSSProperties, ReactNode } from 'react';
import { CARD_BG, RULE, TONE_TOKENS } from '@/lib/editorial-palette';

type Tone = keyof typeof TONE_TOKENS;

interface EdHairlineCardProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  /** İç padding override — varsayılan 18px. */
  padding?: string | number;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article' | 'aside';
}

export function EdHairlineCard({
  children,
  tone,
  className = '',
  padding = 18,
  style,
  as: Tag = 'div',
}: EdHairlineCardProps) {
  const t = tone ? TONE_TOKENS[tone] : null;
  return (
    <Tag
      className={className}
      style={{
        position: 'relative',
        backgroundColor: t?.bg ?? CARD_BG,
        border: `1px solid ${t?.border ?? RULE}`,
        borderLeftWidth: t ? 4 : 1,
        borderLeftColor: t?.border ?? RULE,
        borderRadius: 4,
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        color: t?.ink,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
