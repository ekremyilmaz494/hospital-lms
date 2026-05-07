/**
 * KPI kartı — ring + kicker + label + opsiyonel sub.
 * Hairline kart üstünde RingProgress + sağ tarafta editorial metrik metni.
 *
 * Mobil davranış: kart kendi container'ına göre tepki verir (container query).
 * Dar hücrelerde (< 280px) ring 64px'e düşer, layout dikey yığılır,
 * sub satırı gizlenir → "kicker + label" kompakt formuyla okunaklı kalır.
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
  // Dar container'da küçük halka render et (container query 280px altında).
  const compactSize = Math.min(size, 64);
  return (
    <EdHairlineCard
      padding="18px 20px"
      className="ed-kpi-card @container"
    >
      <div className="ed-kpi-card__row flex items-center gap-[18px] @max-[280px]:flex-col @max-[280px]:items-start @max-[280px]:gap-3">
        <div className="ed-kpi-card__ring-md">
          <RingProgress
            percent={percent}
            color={color}
            size={size}
            stroke={8}
            valueOverride={valueOverride}
          />
        </div>
        <div className="ed-kpi-card__ring-sm hidden">
          <RingProgress
            percent={percent}
            color={color}
            size={compactSize}
            stroke={6}
            valueOverride={valueOverride}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
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
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 'clamp(15px, 2.6cqw + 0.5rem, 17px)',
              fontWeight: 600,
              color: INK,
              letterSpacing: '-0.01em',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {label}
          </div>
          {sub && (
            <div
              className="ed-kpi-card__sub mt-1"
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
      <style>{`
        @container (max-width: 280px) {
          .ed-kpi-card .ed-kpi-card__ring-md { display: none; }
          .ed-kpi-card .ed-kpi-card__ring-sm { display: block; }
          .ed-kpi-card .ed-kpi-card__sub { display: none; }
        }
      `}</style>
    </EdHairlineCard>
  );
}
