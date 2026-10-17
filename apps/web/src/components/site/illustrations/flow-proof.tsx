import { Check, DocSheet, Paper, Phone, Pulse, Qr, Scene, Seal, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const BARS = [
  { x: 222, top: 96 },
  { x: 236, top: 84 },
  { x: 250, top: 90 },
  { x: 264, top: 72 },
] as const

/** Tarama çerçevesinin dört L köşesi (merkez, yarım kenar, kol uzunluğu). */
function scanCorners(cx: number, cy: number, half: number, arm: number): string[] {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const x = cx + sx * half
    const y = cy + sy * half
    return `M${x} ${y - sy * arm}V${y}H${x - sx * arm}`
  })
}

/**
 * Akış adım 4 "Kanıtlayın": mühürlü ve QR'lı sertifika önde, arkasında denetim
 * raporu; telefon QR'ı tarar ve sertifikanın doğrulandığını gösterir.
 */
export function FlowProofIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <g className="s-pop">
        <DocSheet x={120} y={32} w={176} h={196} lines={0} stroke="line" />
        <TextLines x={136} y={58} w={64} count={1} stroke="ink" />
        <TextLines x={136} y={80} w={60} count={3} gap={12} />
        <line x1={212} y1={112} x2={278} y2={112} className="s-line" />
        {BARS.map(({ x, top }, i) => (
          <line key={x} x1={x} y1={104} x2={x} y2={top} strokeWidth={7} className={i === 3 ? 's-brand' : 's-line'} />
        ))}
      </g>

      <g className="s-pop" style={delay(150)}>
        <Paper x={40} y={120} w={212} h={156} r={10} stroke="ink" />
        <Paper x={50} y={130} w={192} h={136} r={6} tone="none" />
        <TextLines x={98} y={154} w={96} count={1} stroke="ink" />
        <TextLines x={80} y={172} w={132} count={1} />
        <TextLines x={110} y={186} w={72} count={1} />
        <Seal cx={94} cy={226} r={22} />
        <Qr x={174} y={204} size={44} />
      </g>

      <g className="s-pop" style={delay(300)}>
        <Phone x={324} y={60} w={116} h={232}>
          <g className="s-brand">
            {scanCorners(382, 162, 32, 13).map((d) => (
              <path key={d} d={d} className="s-draw" pathLength={1} style={delay(600)} />
            ))}
          </g>
          <Check cx={382} cy={162} r={15} style={delay(900)} />
          <TextLines x={350} y={230} w={64} count={2} gap={14} widths={[1, 0.6]} />
        </Phone>
      </g>

      <Pulse x={16} y={324} w={448} amp={22} at={0.3} style={delay(200)} />
    </Scene>
  )
}
