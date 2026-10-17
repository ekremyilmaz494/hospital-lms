import { Check, DocSheet, Paper, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const QUESTIONS = [
  { y: 100, pick: 1 },
  { y: 176, pick: 0 },
  { y: 252, pick: 2 },
] as const

/** Seçenek dairelerinin merkezleri: ilk dairenin sol kenarı soru satırıyla (x=54) hizalı. */
const OPTIONS = [61, 117, 173]

/**
 * Akış 3 "Ölçün": işaretlenmiş sınav kâğıdı ve yanında ön sınavdan son sınava
 * yükselen iki sütun. Sahne süs: anlamı yanındaki adım metni taşır.
 */
export function FlowExamIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <DocSheet x={40} y={40} w={200} h={280} lines={0} />
      <TextLines x={54} y={68} w={110} count={1} stroke="ink" />

      {QUESTIONS.map(({ y, pick }, i) => (
        <g key={y}>
          <TextLines x={54} y={y} w={160} count={2} gap={12} widths={[1, 0.55]} />
          {OPTIONS.map((ox, j) => (
            <g key={ox}>
              <circle
                cx={ox} cy={y + 34} r={7}
                className={j === pick ? 's-fill-brand s-brand s-pop' : 's-fill-paper s-ink'}
                style={j === pick ? delay(250 + i * 150) : undefined}
              />
              <line x1={ox + 14} y1={y + 34} x2={ox + 36} y2={y + 34} className="s-line" />
            </g>
          ))}
        </g>
      ))}

      <line x1={280} y1={296} x2={448} y2={296} className="s-line" />
      <Paper x={292} y={232} w={52} h={64} r={6} tone="sunken" stroke="ink" />
      <rect x={384} y={104} width={52} height={192} rx={6} className="s-fill-brand s-pop" stroke="none" style={delay(700)} />
      <path d="M364 224V152M354 162l10-10 10 10" className="s-brand s-draw" pathLength={1} style={delay(850)} />
      <Check cx={410} cy={80} style={delay(1000)} />
    </Scene>
  )
}
