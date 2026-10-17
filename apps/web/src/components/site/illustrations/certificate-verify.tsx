import { Check, Paper, Pulse, Qr, Scene, Seal, Shield, TextLines, delay } from './_primitives'
import type { IllustrationProps } from '.'

const WINDOW_DOTS = [290, 302, 314] as const

/**
 * Sertifika doğrulama: büyük sertifikanın QR'ından kesikli bir bağ, herkese açık
 * doğrulama sayfasına uzanır; sayfada kalkan ve onay sertifikanın gerçek olduğunu gösterir.
 */
export function CertificateVerifyIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <g className="s-pop">
        <Paper x={24} y={48} w={200} h={264} r={10} stroke="ink" />
        <Paper x={34} y={58} w={180} h={244} r={6} tone="none" />
        <TextLines x={76} y={90} w={96} count={1} stroke="ink" />
        <TextLines x={56} y={108} w={136} count={1} />
        <Pulse x={56} y={150} w={136} amp={16} at={0.5} style={delay(300)} />
        <TextLines x={56} y={184} w={136} count={3} gap={14} widths={[1, 0.82, 0.56]} />
        <Seal cx={80} cy={258} r={24} />
        <Qr x={150} y={234} size={48} />
      </g>

      <g className="s-pop" style={delay(450)}>
        <path d="M230 258H264" className="s-brand" strokeDasharray="4 6" />
        <path d="M262 252l6 6-6 6" className="s-brand" />
        <circle cx={224} cy={258} r={3.5} className="s-fill-brand" stroke="none" />
      </g>

      <g className="s-pop" style={delay(250)}>
        <Paper x={272} y={100} w={184} h={196} r={10} stroke="ink" />
        {WINDOW_DOTS.map((x) => (
          <circle key={x} cx={x} cy={115} r={3.5} className="s-fill-sunken s-line" />
        ))}
        <rect x={328} y={108} width={112} height={14} rx={6} className="s-fill-sunken" stroke="none" />
        <line x1={272} y1={130} x2={456} y2={130} className="s-line" />
        <Shield cx={364} cy={192} s={1.7} />
        <Check cx={364} cy={190} r={13} style={delay(750)} />
        <TextLines x={316} y={248} w={96} count={1} />
        <TextLines x={334} y={262} w={60} count={1} />
      </g>
    </Scene>
  )
}
