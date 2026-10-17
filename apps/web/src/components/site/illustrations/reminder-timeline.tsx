import type { ReactNode } from 'react'
import { AttnDot, Bell, Check, Clock, Scene, delay } from './_primitives'
import type { IllustrationProps } from '.'

// Geniş şerit sahne (640×212): düğümler alttaki 4 sütunlu listenin sütun ortalarına
// denk gelir (1200px kapsayıcı, 32px aralık → %11,5 / %37,2 / %62,8 / %88,5).
const SCENE_W = 640
const SCENE_H = 212
const LINE_Y = 130
const BADGE_Y = 66
const BADGE_R = 30
const NODE_X = [74, 238, 402, 566]
/** Ana çizgi boyunca gün tikleri (düğüm hizaları hariç). */
const DAY_TICKS = [115, 156, 197, 279, 320, 361, 443, 484, 525]

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

const [N1, N2, N3, N4] = NODE_X
const NODES: Array<{ x: number; icon: ReactNode }> = [
  { x: N1, icon: <Check cx={N1} cy={BADGE_Y} r={15} /> },
  { x: N2, icon: <Bell cx={N2} cy={BADGE_Y - 3} s={1.5} /> },
  {
    x: N3,
    icon: (
      <g>
        <Clock cx={N3} cy={BADGE_Y} r={15} />
        <AttnDot cx={N3 + 12} cy={BADGE_Y - 12} r={4.5} />
      </g>
    ),
  },
  { x: N4, icon: <Renew cx={N4} cy={BADGE_Y} /> },
]

/**
 * Otomatik takip: zaman çizelgesinde atama, hatırlatma, yaklaşan son tarih ve
 * yenileme düğümleri; her birinin altında takvim yaprağı. Sahne süs.
 */
export function ReminderTimelineIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className} width={SCENE_W} height={SCENE_H}>
      <path d={DAY_TICKS.map((x) => `M${x} ${LINE_Y + 8}v6`).join('')} className="s-line" />
      <path d={`M24 ${LINE_Y}H${N3}`} className="s-brand s-draw" pathLength={1} strokeWidth={2.25} />
      <path d={`M${N3 + 8} ${LINE_Y}H616`} className="s-line" strokeDasharray="2 6" />

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
