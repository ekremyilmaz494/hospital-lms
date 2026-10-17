import { Lock, Paper, Scene, Shield, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const BLOCKS = [24, 176, 328] as const
const NODES = [44, 92, 140, 188, 236, 284, 332, 380] as const
const TRAIL_Y = 284
const SHIELD_X = 428
const WIDTHS = [[1, 0.86, 0.62, 0.9], [0.9, 1, 0.7, 0.8], [1, 0.74, 0.92, 0.6]]

/**
 * Verileriniz kurumunuza ait: üç hastanenin verisi birbirine bağlanmayan kilitli
 * bloklarda; altta bloklardan bağımsız, zincirlenmiş denetim izi kalkanla biter.
 * Sahne süs: anlamı yanındaki başlık ve açıklama metni taşır.
 */
export function TenantIsolationIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      {BLOCKS.map((x, i) => (
        <g key={x} className="s-pop" style={delay(i * 120)}>
          <Paper x={x} y={60} w={128} h={160} r={16} stroke="ink" />
          <Paper x={x + 16} y={76} w={32} h={32} r={6} tone="tint" stroke="brand" />
          <path d={`M${x + 32} 84v16M${x + 24} 92h16`} className="s-brand" />
          <Lock x={x + 88} y={82} />
          <line x1={x} y1={124} x2={x + 128} y2={124} className="s-line" />
          <TextLines x={x + 16} y={148} w={96} count={4} gap={16} widths={WIDTHS[i]} />
        </g>
      ))}

      {BLOCKS.slice(1).map((x) => (
        <line key={x} x1={x - 12} y1={80} x2={x - 12} y2={200} className="s-ink" strokeDasharray="0 8" />
      ))}

      <path d={`M${NODES[0]} ${TRAIL_Y}H${SHIELD_X - 20}`} className="s-brand s-draw" pathLength={1} style={delay(450)} />
      <g className="s-fill-paper s-brand">
        {NODES.map((x) => (
          <circle key={x} cx={x} cy={TRAIL_Y} r={6} />
        ))}
      </g>
      <g className="s-pop" style={delay(1000)}>
        <Shield cx={SHIELD_X} cy={TRAIL_Y} />
      </g>
    </Scene>
  )
}
