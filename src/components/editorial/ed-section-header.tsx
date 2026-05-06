/**
 * Editorial section header — `[I.] Title — kicker` + opsiyonel sağ aksiyon.
 * Alt çizgi 1px hairline. Roman numeral gold, kicker mono caps.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  FONT_DISPLAY, FONT_MONO, GOLD, INK, INK_SOFT, RULE,
} from '@/lib/editorial-palette';

interface EdSectionHeaderProps {
  numeral?: string;
  title: string;
  kicker?: string;
  actionLabel?: string;
  actionHref?: string;
  /** Aksiyon link yerine custom node istersen. */
  rightSlot?: ReactNode;
}

export function EdSectionHeader({
  numeral,
  title,
  kicker,
  actionLabel,
  actionHref,
  rightSlot,
}: EdSectionHeaderProps) {
  return (
    <header
      className="grid items-end gap-4 pb-3 border-b"
      style={{
        gridTemplateColumns: numeral
          ? '40px 1fr max-content'
          : '1fr max-content',
        borderColor: RULE,
      }}
    >
      {numeral && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 600,
            color: GOLD,
            letterSpacing: '0.20em',
          }}
        >
          {numeral}
        </span>
      )}
      <div>
        <h2
          className="text-[18px] sm:text-[20px] leading-tight font-semibold tracking-[-0.02em]"
          style={{ fontFamily: FONT_DISPLAY, color: INK }}
        >
          {title}
        </h2>
        {kicker && (
          <p
            className="mt-0.5"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: INK_SOFT,
            }}
          >
            {kicker}
          </p>
        )}
      </div>
      {(actionLabel && actionHref) ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5"
          style={{
            color: INK,
            border: `1px solid ${INK}`,
            borderRadius: 2,
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            transition: 'background-color 160ms ease, color 160ms ease',
          }}
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" style={{ color: GOLD }} />
        </Link>
      ) : rightSlot ?? <span />}
    </header>
  );
}
