import { Clock, Lock, Paper, Pulse, Scene, delay } from './_primitives'
import type { IllustrationProps } from '.'

/**
 * İzlemeden geçilmez: eğitim videosunun zaman çubuğunda izlenen kısım yeşil,
 * ileri bölge kilitli, ileri sarma düğmesi pasif (soluk); köşede gerçek izleme süresi saati.
 * Sahne süs: anlamı yanındaki başlık ve açıklama metni taşır.
 */
export function VideoLockIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <Paper x={48} y={36} w={384} h={216} r={16} tone="sunken" stroke="ink" />
      <Pulse x={72} y={212} w={336} amp={28} at={0.5} />

      <g className="s-pop" style={delay(150)}>
        <circle cx={240} cy={136} r={30} className="s-fill-brand" stroke="none" />
        <path d="M231 122L253 136L231 150Z" className="s-fill-paper s-paper" />
      </g>

      <g className="s-pop" style={delay(300)}>
        <Paper x={348} y={52} w={68} h={28} r={10} stroke="line" />
        <Clock cx={364} cy={66} r={10} />
        <line x1={382} y1={66} x2={404} y2={66} className="s-ink" />
      </g>

      <rect x={48} y={311} width={384} height={10} rx={5} className="s-fill-sunken s-line" />
      <line x1={54} y1={316} x2={230} y2={316} className="s-brand s-draw" pathLength={1} strokeWidth={6} style={delay(200)} />
      <circle cx={236} cy={316} r={9} className="s-fill-brand s-paper s-pop" strokeWidth={3} style={delay(700)} />

      <g className="s-pop" style={delay(850)}>
        <path
          d="M260 264H296a10 10 0 0 1 10 10V288a10 10 0 0 1-10 10H271L266 304L261 298H260a10 10 0 0 1-10-10V274a10 10 0 0 1 10-10Z"
          className="s-fill-paper s-ink"
        />
        <path d="M266 275L276 281L266 287ZM278 275L288 281L278 287Z" className="s-line" strokeWidth={2} />
      </g>

      <g className="s-pop" style={delay(1000)}>
        <Lock x={356} y={306} />
      </g>
    </Scene>
  )
}
