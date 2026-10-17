import { DocSheet, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const W = 148
const H = 196

/** El yazısı imza karalamaları (göreli yol kuyrukları); satırlar sırayla dolaşır. */
const SIGNATURES = [
  'c3-8 7-8 8-2s2 8 6 1 5-6 7-1 4 5 9-1h6',
  'q5-10 10-2t10-1 10 1 12-4',
  'c2-6 5-6 6 0s3 5 6 0 4-4 6 0q8 4 18-4',
  'q4-9 8-2t9-1c3 4 6 4 12-3h5',
  'c4-6 7-6 8 0s4 4 8-2q6 6 14-1',
] as const

/** Tablo ızgarası tek yolda: üst bant altında satır ve sütun çizgileri. */
function grid(x: number, y: number): string {
  const rows = [30, 48, 66, 84, 102, 120].map((dy) => `M${x} ${y + dy}H${x + 120}`).join('')
  const cols = [40, 80].map((dx) => `M${x + dx} ${y + 14}V${y + 120}`).join('')
  return rows + cols
}

const SIGN_ROWS = [62, 86, 110, 134, 158] as const

/**
 * Denetim formları: duyuru, tablo ve katılım-imza föyü yelpaze gibi açılmış;
 * önde tek tıkla PDF indirme rozeti.
 */
export function FormsStackIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <g className="s-pop">
        <g transform="rotate(-8 138 154)">
          <DocSheet x={64} y={56} w={W} h={H} lines={0} stroke="line" />
          <TextLines x={78} y={86} w={72} count={1} stroke="ink" />
          <TextLines x={78} y={100} w={36} count={1} stroke="brand" />
          <TextLines x={78} y={124} w={110} count={4} gap={12} widths={[1, 0.9, 0.95, 0.6]} />
          <TextLines x={78} y={184} w={110} count={3} gap={12} widths={[0.95, 1, 0.5]} />
        </g>
      </g>

      <g className="s-pop" style={delay(150)}>
        <g transform="rotate(-1 238 162)">
          <DocSheet x={164} y={64} w={W} h={H} lines={0} stroke="line" />
          <TextLines x={178} y={88} w={64} count={1} stroke="ink" />
          <rect x={178} y={100} width={120} height={14} rx={6} className="s-fill-sunken" stroke="none" />
          <path d={grid(178, 100)} className="s-line" />
        </g>
      </g>

      <g className="s-pop" style={delay(300)}>
        <g transform="rotate(6 336 182)">
          <DocSheet x={262} y={84} w={W} h={H} lines={0} />
          <TextLines x={276} y={114} w={76} count={1} stroke="ink" />
          {SIGN_ROWS.map((dy, i) => (
            <g key={dy}>
              <line x1={276} y1={84 + dy} x2={316} y2={84 + dy} className="s-line" />
              <line x1={330} y1={84 + dy + 6} x2={394} y2={84 + dy + 6} className="s-line" />
              <path
                d={`M334 ${84 + dy}${SIGNATURES[i % SIGNATURES.length]}`}
                className="s-ink s-draw"
                pathLength={1}
                strokeWidth={1.5}
                style={delay(600 + i * 120)}
              />
            </g>
          ))}
        </g>
      </g>

      <g className="s-pop" style={delay(900)}>
        <circle cx={404} cy={290} r={24} className="s-fill-brand s-paper" strokeWidth={3} />
        <path d="M404 278v17M397 289l7 7 7-7M395 303h18" className="s-paper" strokeWidth={2.25} />
      </g>
    </Scene>
  )
}
