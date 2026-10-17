import { AttnDot, Check, Clock, Paper, Person, ProgressBar, Pulse, Qr, Scene, Seal, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const ROWS = [
  { y: 140, state: 'done' },
  { y: 196, state: 'progress' },
  { y: 252, state: 'late' },
] as const

/**
 * Hero: nabız çizgisi bir eğitim kaydı paneline akar. Panelde üç personel satırı
 * (tamamlandı / sürüyor / gecikti), köşede QR'lı ve mühürlü sertifika.
 * Sahne süs: anlamı yanındaki başlık ve açıklama metni taşır.
 */
export function HeroPulseIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className} width={560} height={420}>
      <Paper x={40} y={60} w={380} h={270} r={16} />
      <TextLines x={68} y={98} w={150} count={1} stroke="ink" />
      <line x1={40} y1={118} x2={420} y2={118} className="s-line" />

      {ROWS.map(({ y, state }, i) => (
        <g key={y} className="s-pop" style={delay(150 + i * 120)}>
          <Person cx={82} cy={y + 18} s={0.9} tone="tint" />
          <TextLines x={108} y={y + 12} w={120} count={2} gap={14} widths={[1, 0.6]} />
          {state === 'done' && <Check cx={384} cy={y + 18} r={11} />}
          {state === 'progress' && <ProgressBar x={268} y={y + 18} w={110} value={0.55} style={delay(500)} />}
          {state === 'late' && (
            <g>
              <Clock cx={384} cy={y + 18} r={11} />
              <AttnDot cx={394} cy={y + 8} r={4} />
            </g>
          )}
        </g>
      ))}

      <g className="s-pop" style={delay(650)}>
        <Paper x={400} y={6} w={136} h={130} r={10} stroke="ink" />
        <TextLines x={418} y={32} w={70} count={2} gap={12} widths={[1, 0.7]} />
        <Seal cx={440} cy={98} r={20} />
        <Qr x={474} y={77} size={42} />
      </g>

      <Pulse x={0} y={388} w={560} amp={46} at={0.36} strokeWidth={2.25} />
    </Scene>
  )
}
