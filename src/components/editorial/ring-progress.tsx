/**
 * SVG ring progress — staff KPI ve dashboard'ta kullanılır.
 * Cere fill: `cubic-bezier(0.16, 1, 0.3, 1)` 800ms.
 * Server component — pure markup.
 */
import type { CSSProperties } from 'react';
import { FONT_DISPLAY, FONT_MONO, INK, INK_SOFT, OLIVE, RULE } from '@/lib/editorial-palette';

interface RingProgressProps {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Ring altındaki mono caps etiket. */
  label?: string;
  /** Ring sağında 2 satır mono caps yazı (ör. GENEL / İLERLEME). */
  caption?: [string, string];
  /** Yüzde yerine custom değer göster (örn. "4/6"). */
  valueOverride?: string;
  /** Yüzde yazısının arkasına ekle (`%` yok varsayılan). */
  showPercentSign?: boolean;
}

export function RingProgress({
  percent,
  size = 76,
  stroke = 8,
  color = OLIVE,
  label,
  caption,
  valueOverride,
  showPercentSign = true,
}: RingProgressProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, percent));
  const offset = c - (c * safe) / 100;

  const ringStyle: CSSProperties = {
    transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const ring = (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden style={{ display: 'block' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RULE}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={ringStyle}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
      >
        <span
          className="font-semibold tabular-nums tracking-[-0.025em] leading-none"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: Math.round(size * 0.28),
            color: INK,
          }}
        >
          {valueOverride ?? safe}
          {!valueOverride && showPercentSign && (
            <span
              className="ml-0.5 align-top"
              style={{
                fontFamily: FONT_MONO,
                fontSize: Math.round(size * 0.13),
                color: INK_SOFT,
                fontWeight: 600,
              }}
            >
              %
            </span>
          )}
        </span>
        {label && (
          <span
            className="mt-1"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: INK_SOFT,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );

  if (!caption) return ring;

  return (
    <div className="flex items-center gap-3">
      {ring}
      <div className="flex flex-col">
        {caption.map((line, i) => (
          <span
            key={i}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: INK_SOFT,
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
