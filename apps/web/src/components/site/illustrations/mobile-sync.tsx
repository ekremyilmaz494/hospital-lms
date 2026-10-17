import { AttnDot, Check, Paper, Phone, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const OPTIONS = [146, 176, 206] as const
const QUEUE = [188, 210, 232] as const
const RECEIVED = [168, 196, 224] as const

/**
 * Her yerde: telefonda çevrimdışı çözülen sınav sorusu, sıraya alınmış üç cevap;
 * bağlantı gelince kesikli yoldan panele gider ve onaylanır. Sahne süs.
 */
export function MobileSyncIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <Phone x={40} y={62} w={124} h={236}>
        <TextLines x={60} y={104} w={84} count={2} gap={12} widths={[1, 0.7]} stroke="ink" />
        {OPTIONS.map((y, i) => (
          <g key={y} className="s-pop" style={delay(150 + i * 100)}>
            <Paper x={56} y={y - 11} w={92} h={22} r={6} stroke={i === 1 ? 'brand' : 'line'} />
            <circle cx={68} cy={y} r={5} className={i === 1 ? 's-fill-brand' : 's-line'} stroke={i === 1 ? 'none' : undefined} />
            <line x1={80} y1={y} x2={i === 1 ? 128 : 120} y2={y} className="s-line" />
          </g>
        ))}
        <rect x={56} y={248} width={92} height={22} rx={6} className="s-fill-brand" stroke="none" />
        <line x1={88} y1={259} x2={116} y2={259} className="s-paper" />
      </Phone>

      <g className="s-pop" style={delay(300)}>
        <path d="M192 124h34a10 10 0 0 0 0-20 14 14 0 0 0-27-4 10 10 0 0 0-7 24Z" className="s-fill-paper s-ink" />
        <path d="M190 92l38 40" className="s-ink" />
        <AttnDot cx={230} cy={102} r={4} />
      </g>

      {QUEUE.map((x, i) => (
        <g key={x} className="s-pop" style={delay(450 + i * 100)}>
          <Paper x={x - 8} y={168} w={16} h={16} r={6} tone="tint" stroke="brand" />
          <circle cx={x} cy={176} r={2.5} className="s-fill-brand" stroke="none" />
        </g>
      ))}

      <g className="s-brand s-pop" style={delay(700)}>
        <path d="M252 176H300" strokeDasharray="4 6" />
        <path d="M296 170l6 6-6 6" />
      </g>

      <g className="s-pop" style={delay(800)}>
        <Paper x={312} y={112} w={148} h={136} r={16} />
        <TextLines x={330} y={136} w={64} count={1} stroke="ink" />
        <Check cx={432} cy={136} r={11} style={delay(1000)} />
        <line x1={312} y1={152} x2={460} y2={152} className="s-line" />
        {RECEIVED.map((y) => (
          <g key={y}>
            <rect x={330} y={y - 7} width={14} height={14} rx={6} className="s-fill-tint s-brand" />
            <circle cx={337} cy={y} r={2.5} className="s-fill-brand" stroke="none" />
            <line x1={356} y1={y} x2={440} y2={y} className="s-line" />
          </g>
        ))}
      </g>
    </Scene>
  )
}
