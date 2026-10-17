import { Paper, Phone, ProgressBar, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

/** İki cihazdaki ilerleme çubuklarının ortak yüksekliği: aynı nokta, aynı hiza. */
const BAR_Y = 228

/** Yer imi: ilerleme çubuğunda kalınan nokta. `x` çubuktaki konum, `y` imin üst kenarı; ölçüler çift tam sayı. */
function Bookmark({ x, y, w = 10, h = 14, n = 4 }: { x: number; y: number; w?: number; h?: number; n?: number }) {
  return <path d={`M${x - w / 2} ${y}h${w}v${h}l${-w / 2} ${-n}l${-w / 2} ${n}Z`} className="s-fill-brand s-brand" />
}

/**
 * Akış 2 "Öğrensinler": web oynatıcıda yarıda kalan video, telefonda aynı
 * noktadan sürüyor. Sahne süs: anlamı yanındaki adım metni taşır.
 */
export function FlowLearnIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <Paper x={24} y={56} w={264} h={224} r={16} stroke="ink" />
      <rect x={40} y={72} width={232} height={124} rx={10} className="s-fill-sunken" stroke="none" />
      <circle cx={156} cy={134} r={24} className="s-fill-brand" stroke="none" />
      <path d="M149 123v22l18-11Z" className="s-fill-paper s-paper" />
      <ProgressBar x={40} y={BAR_Y} w={232} value={0.6} style={delay(200)} />
      <g className="s-pop" style={delay(500)}>
        <Bookmark x={179} y={BAR_Y - 24} />
      </g>
      <TextLines x={40} y={256} w={120} count={1} stroke="ink" />
      <TextLines x={176} y={256} w={60} count={1} />

      <g className="s-pop" style={delay(300)}>
        <Phone x={340} y={96} w={116} h={216}>
          <rect x={356} y={128} width={84} height={56} rx={6} className="s-fill-paper" stroke="none" />
          <path d="M392 146v20l15-10Z" className="s-fill-brand s-brand" />
          <ProgressBar x={356} y={BAR_Y} w={84} value={0.6} h={5} style={delay(600)} />
          <TextLines x={356} y={254} w={84} count={3} gap={13} />
        </Phone>
      </g>
      <g className="s-pop" style={delay(800)}>
        <Bookmark x={406} y={BAR_Y - 19} w={8} h={12} n={3} />
        <path d={`M298 ${BAR_Y}H330`} className="s-brand" strokeDasharray="2 6" />
        <circle cx={298} cy={BAR_Y} r={3} className="s-fill-brand" stroke="none" />
        <circle cx={330} cy={BAR_Y} r={3} className="s-fill-brand" stroke="none" />
      </g>
    </Scene>
  )
}
