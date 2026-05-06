/**
 * KPI kartı — ring + kicker + label + opsiyonel sub.
 * Hairline kart üstünde RingProgress + sağ tarafta editorial metrik metni.
 */
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, INK, INK_SOFT, OLIVE } from '@/lib/editorial-palette';
import { EdHairlineCard } from './ed-hairline-card';
import { RingProgress } from './ring-progress';

interface EdKpiCardProps {
  percent: number;
  kicker: string;
  label: string;
  sub?: string;
  color?: string;
  size?: number;
  valueOverride?: string;
}

export function EdKpiCard({
  percent,
  kicker,
  label,
  sub,
  color = OLIVE,
  size = 88,
  valueOverride,
}: EdKpiCardProps) {
  return (
    <EdHairlineCard padding="20px 22px">
      <div className="flex items-center gap-[18px]">
        <RingProgress
          percent={percent}
          color={color}
          size={size}
          stroke={8}
          valueOverride={valueOverride}
        />
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: GOLD,
              marginBottom: 6,
            }}
          >
            {kicker}
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 17,
              fontWeight: 600,
              color: INK,
              letterSpacing: '-0.01em',
            }}
          >
            {label}
          </div>
          {sub && (
            <div
              className="mt-1"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: INK_SOFT,
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
    </EdHairlineCard>
  );
}
