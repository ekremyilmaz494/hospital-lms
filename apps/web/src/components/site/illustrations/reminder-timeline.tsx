import type { ReactNode } from 'react'
import { AttnDot, Bell, Check, Clock, Scene, delay } from './_primitives'
import type { IllustrationProps } from '.'

// Yatay şerit sahne: içerik ~150 birim yüksek, viewBox 480×240 (boş dikey alan yok).
const SCENE_H = 240
const LINE_Y = 139
const BADGE_Y = 75
const BADGE_R = 30
/** Ana çizgi boyunca gün tikleri (düğüm hizaları hariç). */
const DAY_TICKS = [100, 128, 156, 212, 240, 268, 324, 352, 380]

/** Küçük takvim yaprağı: üst şerit, iki halka, tek işaretli gün. */
function CalendarTick({ x, y, done }: { x: number; y: number; done: boolean }) {
  return (
    <g>
      <rect x={x - 13} y={y} width={26} height={24} rx={6} className="s-fill-paper s-ink" />
      <path d={`M${x - 13} ${y + 8}H${x + 13}M${x - 6} ${y - 4}v6M${x + 6} ${y - 4}v6`} className="s-ink" />
      <circle cx={x} cy={y + 16} r={3} className={done ? 's-fill-brand' : 's-fill-ink'} stroke="none" />
    </g>
  )
}

/** Yenileme: açık yay + üstte sağa bakan ok ucu. */
function Renew({ cx: x, cy: y }: { cx: number; cy: number }) {
  return (
    <g className="s-brand" strokeWidth={2}>
      <path d={`M${x + 9.5} ${y - 9.5}A13.5 13.5 0 1 1 ${x} ${y - 13.5}`} />
      <path d={`M${x - 5} ${y - 19}L${x + 0.5} ${y - 13.5}L${x - 5} ${y - 8}`} />
    </g>
  )
}

const NODES: Array<{ x: number; icon: ReactNode }> = [
  { x: 72, icon: <Check cx={72} cy={BADGE_Y} r={15} /> },
  { x: 184, icon: <Bell cx={184} cy={BADGE_Y - 3} s={1.5} /> },
  {
    x: 296,
    icon: (
      <g>
        <Clock cx={296} cy={BADGE_Y} r={15} />
        <AttnDot cx={308} cy={BADGE_Y - 12} r={4.5} />
      </g>
    ),
  },
  { x: 408, icon: <Renew cx={408} cy={BADGE_Y} /> },
]

/**
 * Otomatik takip: zaman çizelgesinde atama, hatırlatma, yaklaşan son tarih ve
 * yenileme düğümleri; her birinin altında takvim yaprağı. Sahne süs.
 */
export function ReminderTimelineIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className} height={SCENE_H}>
      <path d={DAY_TICKS.map((x) => `M${x} ${LINE_Y + 8}v6`).join('')} className="s-line" />
      <path d={`M32 ${LINE_Y}H296`} className="s-brand s-draw" pathLength={1} strokeWidth={2.25} />
      <path d={`M304 ${LINE_Y}H448`} className="s-line" strokeDasharray="2 6" />

      {NODES.map(({ x, icon }, i) => (
        <g key={x} className="s-pop" style={delay(200 + i * 160)}>
          <circle cx={x} cy={BADGE_Y} r={BADGE_R} className="s-fill-paper s-line" />
          {icon}
          <line x1={x} y1={BADGE_Y + BADGE_R} x2={x} y2={LINE_Y - 7} className="s-line" />
          <circle cx={x} cy={LINE_Y} r={5.5} className={i < 3 ? 's-fill-brand' : 's-fill-paper s-brand'} stroke={i < 3 ? 'none' : undefined} />
          <CalendarTick x={x} y={LINE_Y + 32} done={i < 2} />
        </g>
      ))}
    </Scene>
  )
}
