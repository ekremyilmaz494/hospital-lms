import { AttnDot, Clock, Paper, Person, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const GROUPS = [
  { y: 36, people: [346, 386, 426] },
  { y: 144, people: [366, 406] },
  { y: 252, people: [346, 386, 426] },
] as const

const ORIGIN = { x: 200, y: 180 }

/**
 * Akış 1 "Atayın": son tarihli eğitim kartından üç departman grubuna dallanan
 * atama bağlantıları. Sahne süs: anlamı yanındaki adım metni taşır.
 */
export function FlowAssignIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <Paper x={24} y={96} w={176} h={168} r={16} stroke="ink" />
      <rect x={40} y={112} width={144} height={80} rx={10} className="s-fill-sunken" stroke="none" />
      <path d="M104 138v28l24-14Z" className="s-fill-brand s-brand" />
      <TextLines x={40} y={214} w={96} count={1} stroke="ink" />
      <TextLines x={40} y={232} w={92} count={2} gap={14} widths={[1, 0.6]} />
      <Clock cx={170} cy={238} r={11} />
      <AttnDot cx={180} cy={228} r={4} style={delay(700)} />

      {GROUPS.map(({ y }, i) => {
        const ty = y + 36
        const d = ty === ORIGIN.y ? `M${ORIGIN.x} ${ORIGIN.y}H316` : `M${ORIGIN.x} ${ORIGIN.y}C258 ${ORIGIN.y} 258 ${ty} 316 ${ty}`
        return <path key={y} d={d} className="s-brand s-draw" pathLength={1} style={delay(200 + i * 120)} />
      })}
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r={5} className="s-fill-brand" stroke="none" />

      {GROUPS.map(({ y, people }, i) => (
        <g key={y} className="s-pop" style={delay(450 + i * 120)}>
          <Paper x={316} y={y} w={140} h={72} r={16} tone="tint" stroke="line" />
          <circle cx={316} cy={y + 36} r={3.5} className="s-fill-brand" stroke="none" />
          {people.map((px) => (
            <Person key={px} cx={px} cy={y + 37} s={0.9} />
          ))}
        </g>
      ))}
    </Scene>
  )
}
