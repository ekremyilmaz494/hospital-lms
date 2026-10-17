import { AttnDot, Bell, Check, DocSheet, Paper, Pulse, Scene, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const ROWS = [156, 204, 252] as const

/**
 * Bugünkü yöntem: eğik bir tablo, imzalı kâğıt föy ve çalan zil (kaçan hatırlatma)
 * dağınık durur; nabız çizgisi onları toplayıp onaylı üç satırlık tek listeye akıtır.
 * Sahne süs: anlamı yanındaki başlık ve açıklama metni taşır.
 */
export function ScatterToOrderIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <g className="s-pop">
        <g transform="rotate(-7 88 88)">
          <Paper x={24} y={44} w={128} h={88} tone="sunken" stroke="ink" />
          <path d="M24 66H152M24 88H152M24 110H152M66 44V132M109 44V132" className="s-line" />
        </g>
      </g>

      <g className="s-pop" style={delay(120)}>
        <g transform="rotate(6 104 226)">
          <DocSheet x={58} y={170} w={92} h={112} lines={3} />
          <path d="M72 260c5-12 9-12 11 0s6 9 9-2 8-10 11 1 6 6 13-4" className="s-ink s-draw" pathLength={1} style={delay(400)} />
        </g>
      </g>

      <g className="s-pop" style={delay(240)}>
        <g transform="rotate(14 212 100)">
          <Bell cx={212} cy={100} s={2} />
        </g>
        <path d="M182.5 91A30 30 0 0 1 192.5 73M231.5 73A30 30 0 0 1 241.5 91" className="s-ink" />
        <AttnDot cx={226} cy={84} r={4.5} />
      </g>

      <Pulse x={176} y={222} w={124} amp={34} at={0.5} strokeWidth={2.25} style={delay(300)} />

      <g className="s-pop" style={delay(500)}>
        <Paper x={300} y={92} w={160} h={196} r={16} />
        <TextLines x={320} y={118} w={80} count={1} stroke="ink" />
        <line x1={300} y1={134} x2={460} y2={134} className="s-line" />
        {ROWS.map((y, i) => (
          <g key={y}>
            <TextLines x={320} y={y + 12} w={76} count={2} gap={12} widths={[1, 0.6]} />
            <Check cx={432} cy={y + 18} r={10} style={delay(700 + i * 120)} />
          </g>
        ))}
      </g>
    </Scene>
  )
}
