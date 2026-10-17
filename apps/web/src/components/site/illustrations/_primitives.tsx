import type { CSSProperties, ReactNode } from 'react'

/**
 * KlinoVax illüstrasyon sistemi: ortak parçalar.
 *
 * Kurallar (illustrations.test.tsx denetler): ham renk yok, renk yalnız rol
 * sınıflarıyla (`s-ink`, `s-brand`, `s-line`, `s-fill-*`, `s-attn`); metin,
 * gradyan, filtre, görsel yok; çizgi 1,75; sahne başına tek kehribar nokta.
 * Animasyon yalnız `s-draw` (yol çizimi, `pathLength={1}`) ve `s-pop` (belirme),
 * ikisi de `site.css`'te ve reduced-motion'da kapalı. Hepsi Server Component.
 */

export type Tone = 'paper' | 'tint' | 'sunken' | 'brand' | 'none'
export type Stroke = 'ink' | 'brand' | 'line' | 'paper' | 'none'

const fillClass = (tone: Tone) => (tone === 'none' ? '' : `s-fill-${tone}`)
const strokeClass = (stroke: Stroke) => (stroke === 'none' ? '' : `s-${stroke}`)
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ') || undefined

/** Belirme/çizim gecikmesi: `site.css` `--d` değişkenini okur. */
export function delay(ms?: number): CSSProperties | undefined {
  return ms ? ({ '--d': `${ms}ms` } as CSSProperties) : undefined
}

interface SceneProps {
  children: ReactNode
  /** Bilgi taşıyorsa ekran okuyucu etiketi; verilmezse sahne süs sayılır (aria-hidden). */
  label?: string
  className?: string
  width?: number
  height?: number
}

/** Sahne kökü. `data-reveal` → görünür olunca `data-in` alır (SiteReveal). */
export function Scene({ children, label, className, width = 480, height = 360 }: SceneProps) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cx('s-illo', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-reveal=""
      {...a11y}
    >
      {children}
    </svg>
  )
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Yuvarlatılmış yüzey (kart, panel, ekran). Yarıçap ölçeği 6 / 10 / 16. */
export function Paper({
  x, y, w, h, r = 10, tone = 'paper', stroke = 'line', className, style,
}: Box & { r?: 6 | 10 | 16 | 20; tone?: Tone; stroke?: Stroke; className?: string; style?: CSSProperties }) {
  return (
    <rect
      x={x} y={y} width={w} height={h} rx={r}
      className={cx(fillClass(tone), strokeClass(stroke), className)}
      // Rol sınıfı yokken kökteki stroke="currentColor" miras alınmasın.
      stroke={stroke === 'none' ? 'none' : undefined}
      style={style}
    />
  )
}

/** Yatay metin satırları (okunur metin yerine). `widths` 0-1 oranları, sırayla tekrarlanır. */
export function TextLines({
  x, y, w, count = 3, gap = 12, widths = [1, 0.86, 0.62], stroke = 'line',
}: { x: number; y: number; w: number; count?: number; gap?: number; widths?: number[]; stroke?: Stroke }) {
  return (
    <g className={strokeClass(stroke)}>
      {Array.from({ length: count }, (_, i) => {
        const len = Math.round(w * widths[i % widths.length])
        return <line key={i} x1={x} y1={y + i * gap} x2={x + len} y2={y + i * gap} />
      })}
    </g>
  )
}

/** Kıvrık köşeli belge + satırlar. Denetim formu, rapor, föy. */
export function DocSheet({
  x, y, w = 96, h = 124, lines = 4, tone = 'paper', stroke = 'ink', className, style,
}: Partial<Box> & { x: number; y: number; lines?: number; tone?: Tone; stroke?: Stroke; className?: string; style?: CSSProperties }) {
  const f = 16
  return (
    <g className={className} style={style}>
      <path
        d={`M${x + 6} ${y}H${x + w - f}L${x + w} ${y + f}V${y + h - 6}a6 6 0 0 1-6 6H${x + 6}a6 6 0 0 1-6-6V${y + 6}a6 6 0 0 1 6-6Z`}
        className={cx(fillClass(tone), strokeClass(stroke))}
      />
      <path d={`M${x + w - f} ${y}V${y + f}H${x + w}`} className={strokeClass(stroke)} />
      <TextLines x={x + 14} y={y + 28} w={w - 34} count={lines} gap={14} />
    </g>
  )
}

/**
 * EKG/nabız yolu: düz → küçük dalga → keskin tepe → düz. Markanın imza çizgisi.
 * `x,y` taban çizgisinin başı, `w` toplam genişlik, `amp` tepe yüksekliği.
 * `at` 0-1: tepenin yatay konumu.
 */
export function pulsePath(x: number, y: number, w: number, amp = 40, at = 0.5): string {
  const c = Math.round(x + w * at)
  const u = Math.max(4, Math.round(amp / 6))
  return [
    `M${x} ${y}`,
    `H${c - 7 * u}`,
    `l${u * 1.5} ${-u * 1.2}l${u * 1.5} ${u * 1.2}`,
    `H${c - 2 * u}`,
    `L${c - u} ${y + u}`,
    `L${c} ${y - amp}`,
    `L${c + u * 1.3} ${y + amp * 0.45}`,
    `L${c + u * 2.2} ${y}`,
    `H${c + 5 * u}`,
    `q${u * 1.6} ${-u * 2.2} ${u * 3.2} 0`,
    `H${x + w}`,
  ].join('')
}

export function Pulse({
  x, y, w, amp, at, stroke = 'brand', draw = true, strokeWidth, style,
}: { x: number; y: number; w: number; amp?: number; at?: number; stroke?: Stroke; draw?: boolean; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <path
      d={pulsePath(x, y, w, amp, at)}
      className={cx(strokeClass(stroke), draw && 's-draw')}
      pathLength={draw ? 1 : undefined}
      strokeWidth={strokeWidth}
      style={style}
    />
  )
}

/** Dolu yeşil daire içinde onay işareti. */
export function Check({ cx: x, cy: y, r = 12, style }: { cx: number; cy: number; r?: number; style?: CSSProperties }) {
  const s = r / 12
  return (
    <g className="s-pop" style={style}>
      <circle cx={x} cy={y} r={r} className="s-fill-brand" stroke="none" />
      <path d={`M${x - 5 * s} ${y}l${3.5 * s} ${3.5 * s}l${6.5 * s} ${-7 * s}`} className="s-paper" strokeWidth={2} />
    </g>
  )
}

/** Asma kilit. `x,y` gövdenin sol üstü, `s` ölçek (1 = 24×20 gövde). */
export function Lock({ x, y, s = 1, stroke = 'ink', tone = 'paper' }: { x: number; y: number; s?: number; stroke?: Stroke; tone?: Tone }) {
  const w = 24 * s
  const h = 20 * s
  return (
    <g>
      <path d={`M${x + 5 * s} ${y}V${y - 6 * s}a${7 * s} ${7 * s} 0 0 1 ${14 * s} 0V${y}`} className={strokeClass(stroke)} />
      <rect x={x} y={y} width={w} height={h} rx={5 * s} className={cx(fillClass(tone), strokeClass(stroke))} />
      <path d={`M${x + w / 2} ${y + 7 * s}v${6 * s}`} className={strokeClass(stroke)} />
    </g>
  )
}

// 7×7 sabit desen: üç köşe bulucusu + sağ alt çeyrekte modüller. Gerçek veri kodlamaz.
const QR_MODULES = [[3, 3], [5, 3], [3, 5], [4, 4], [6, 4], [5, 5], [4, 6], [6, 6]]

/** Sembolik QR kodu. `size` kenar uzunluğu. */
export function Qr({ x, y, size = 42 }: { x: number; y: number; size?: number }) {
  const m = size / 7
  const corners = [[0, 0], [4, 0], [0, 4]]
  return (
    <g>
      {corners.map(([fx, fy]) => (
        <rect key={`f${fx}${fy}`} x={x + fx * m + 0.9} y={y + fy * m + 0.9} width={m * 3 - 1.8} height={m * 3 - 1.8} rx={m * 0.5} className="s-ink" />
      ))}
      <g className="s-fill-ink" stroke="none">
        {corners.map(([fx, fy]) => (
          <rect key={`c${fx}${fy}`} x={x + (fx + 1) * m} y={y + (fy + 1) * m} width={m} height={m} rx={m * 0.2} />
        ))}
        {QR_MODULES.map(([mx, my]) => (
          <rect key={`${mx}-${my}`} x={x + mx * m + m * 0.15} y={y + my * m + m * 0.15} width={m * 0.7} height={m * 0.7} rx={m * 0.2} />
        ))}
      </g>
    </g>
  )
}

/** Telefon çerçevesi + ekran yüzeyi. Ekran içeriği `children` ile, ekran kutusu: x+8, y+18, w-16, h-30. */
export function Phone({ x, y, w = 120, h = 236, children }: { x: number; y: number; w?: number; h?: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={20} className="s-fill-paper s-ink" />
      <rect x={x + 8} y={y + 18} width={w - 16} height={h - 30} rx={10} className="s-fill-sunken" stroke="none" />
      <line x1={x + w / 2 - 12} y1={y + 9} x2={x + w / 2 + 12} y2={y + 9} className="s-line" />
      {children}
    </g>
  )
}

/** Hatırlatma zili. */
export function Bell({ cx: x, cy: y, s = 1, stroke = 'ink' }: { cx: number; cy: number; s?: number; stroke?: Stroke }) {
  return (
    <g className={strokeClass(stroke)}>
      <path d={`M${x - 9 * s} ${y + 6 * s}h${18 * s}l${-2 * s} ${-3 * s}v${-6 * s}a${7 * s} ${7 * s} 0 0 0 ${-14 * s} 0v${6 * s}Z`} />
      <path d={`M${x - 3 * s} ${y + 10 * s}a${3 * s} ${3 * s} 0 0 0 ${6 * s} 0`} />
    </g>
  )
}

/** Saat (vardiya, son tarih). */
export function Clock({ cx: x, cy: y, r = 14, stroke = 'ink', tone = 'paper' }: { cx: number; cy: number; r?: number; stroke?: Stroke; tone?: Tone }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className={cx(fillClass(tone), strokeClass(stroke))} />
      <path d={`M${x} ${y - r * 0.55}V${y}l${r * 0.4} ${r * 0.3}`} className={strokeClass(stroke)} />
    </g>
  )
}

/** Kalkan (güvenlik, izolasyon). `s` ölçek, 1 = 28×34. */
export function Shield({ cx: x, cy: y, s = 1, stroke = 'brand', tone = 'tint' }: { cx: number; cy: number; s?: number; stroke?: Stroke; tone?: Tone }) {
  return (
    <path
      d={`M${x} ${y - 17 * s}l${14 * s} ${5 * s}v${9 * s}c0 ${9 * s}-${6 * s} ${15 * s}-${14 * s} ${20 * s}c-${8 * s}-${5 * s}-${14 * s}-${11 * s}-${14 * s}-${20 * s}v-${9 * s}Z`}
      className={cx(fillClass(tone), strokeClass(stroke))}
    />
  )
}

/** Soyut kişi (baş + omuz). Yüz, cinsiyet, kıyafet çizilmez. */
export function Person({ cx: x, cy: y, s = 1, stroke = 'ink', tone = 'paper' }: { cx: number; cy: number; s?: number; stroke?: Stroke; tone?: Tone }) {
  return (
    <g className={cx(fillClass(tone), strokeClass(stroke))}>
      <circle cx={x} cy={y - 6 * s} r={6 * s} />
      <path d={`M${x - 11 * s} ${y + 13 * s}a${11 * s} ${10 * s} 0 0 1 ${22 * s} 0Z`} />
    </g>
  )
}

/** Mühür halkası (onaylı belge, sertifika). */
export function Seal({ cx: x, cy: y, r = 18 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="s-fill-tint s-brand" />
      <circle cx={x} cy={y} r={r - 5} className="s-brand" strokeDasharray="2 4" />
      <path d={`M${x - r * 0.3} ${y}l${r * 0.22} ${r * 0.22}l${r * 0.4} ${-r * 0.42}`} className="s-brand" strokeWidth={2} />
    </g>
  )
}

/** İlerleme çubuğu. `value` 0-1. */
export function ProgressBar({ x, y, w, value, h = 6, draw = true, style }: { x: number; y: number; w: number; value: number; h?: number; draw?: boolean; style?: CSSProperties }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + w} y2={y} className="s-line" strokeWidth={h} />
      <line
        x1={x} y1={y} x2={x + Math.round(w * value)} y2={y}
        className={cx('s-brand', draw && 's-draw')}
        pathLength={draw ? 1 : undefined}
        strokeWidth={h}
        style={style}
      />
    </g>
  )
}

/** Kehribar dikkat noktası. Sahne başına EN ÇOK bir tane (test sayar). */
export function AttnDot({ cx: x, cy: y, r = 5, style }: { cx: number; cy: number; r?: number; style?: CSSProperties }) {
  return <circle cx={x} cy={y} r={r} className="s-attn s-pop" style={style} />
}
