/**
 * Mono caps yardımcı etiket — kicker, "TÜMÜ" gibi 0.16em tracking'li
 * uppercase küçük metinler için.
 */
import type { CSSProperties, ReactNode } from 'react';
import { FONT_MONO, INK_SOFT } from '@/lib/editorial-palette';

interface EdMonoLabelProps {
  children: ReactNode;
  size?: 9 | 10 | 11 | 12;
  tracking?: '0.12em' | '0.14em' | '0.16em' | '0.20em' | '0.28em';
  color?: string;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

export function EdMonoLabel({
  children,
  size = 10,
  tracking = '0.16em',
  color = INK_SOFT,
  className = '',
  as: Tag = 'span',
}: EdMonoLabelProps) {
  const style: CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: `${size}px`,
    letterSpacing: tracking,
    fontWeight: 600,
    textTransform: 'uppercase',
    color,
    fontVariantNumeric: 'tabular-nums',
  };
  return (
    <Tag className={className} style={style}>
      {children}
    </Tag>
  );
}
