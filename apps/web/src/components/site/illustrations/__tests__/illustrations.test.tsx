import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ILLUSTRATIONS } from '..'

/** Sahne başına render edilmiş markup sınırı (RSC payload'ında ikinci kez gider). */
const SCENE_MAX_BYTES = 5 * 1024
/** Tüm sahnelerin toplam sınırı. */
const TOTAL_MAX_BYTES = 60 * 1024

const entries = Object.entries(ILLUSTRATIONS).map(([name, Scene]) => ({
  name,
  html: renderToStaticMarkup(<Scene />),
}))

describe('illüstrasyon sistemi kuralları', () => {
  it('toplam boyut bütçesi', () => {
    const total = entries.reduce((sum, e) => sum + Buffer.byteLength(e.html), 0)
    expect(total).toBeLessThanOrEqual(TOTAL_MAX_BYTES)
  })

  for (const { name, html } of entries) {
    describe(name, () => {
      it(`≤ ${SCENE_MAX_BYTES} bayt`, () => {
        expect(Buffer.byteLength(html)).toBeLessThanOrEqual(SCENE_MAX_BYTES)
      })

      it('tek kök svg: s-illo, viewBox, data-reveal, 1.75 çizgi', () => {
        expect(html.startsWith('<svg')).toBe(true)
        expect(html.match(/<svg/g)).toHaveLength(1)
        expect(html).toMatch(/^<svg[^>]*class="s-illo/)
        expect(html).toMatch(/^<svg[^>]*viewBox="0 0 \d+ \d+"/)
        expect(html).toMatch(/^<svg[^>]*data-reveal=""/)
        expect(html).toMatch(/^<svg[^>]*stroke-width="1.75"/)
      })

      it('boş taslak değil (en az 12 çizim öğesi)', () => {
        expect((html.match(/<(path|rect|circle|line|ellipse|polyline|polygon)\b/g) ?? []).length).toBeGreaterThanOrEqual(12)
      })

      it('erişilebilirlik: ya aria-hidden ya role=img + aria-label', () => {
        const root = html.match(/^<svg[^>]*>/)![0]
        const hidden = root.includes('aria-hidden="true"')
        const labelled = root.includes('role="img"') && /aria-label="[^"]{8,}"/.test(root)
        expect(hidden !== labelled).toBe(true)
        expect(root).toContain('focusable="false"')
      })

      it('ham renk yok (hex, rgb, hsl, renk adı, inline color)', () => {
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(html).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\(/)
        expect(html).not.toMatch(/(fill|stroke)="(?!none|currentColor)[a-z]+"/)
        expect(html).not.toMatch(/style="[^"]*(color|fill|stroke)\s*:/)
      })

      it('yasak öğe yok (metin, gradyan, filtre, görsel, script)', () => {
        expect(html).not.toMatch(/<(text|tspan|linearGradient|radialGradient|filter|image|foreignObject|script|style|animate\w*)\b/)
        expect(html).not.toMatch(/\bfilter=|\bmask=|\bclip-path=/)
      })

      it('kehribar dikkat noktası en çok bir', () => {
        expect((html.match(/\bs-attn\b/g) ?? []).length).toBeLessThanOrEqual(1)
      })

      it('çizim animasyonlu yollar pathLength=1 taşır', () => {
        for (const tag of html.match(/<[a-z]+[^>]*\bs-draw\b[^>]*>/g) ?? []) {
          expect(tag).toContain('pathLength="1"')
        }
      })

      it('kalın çizgi istisnası dışında stroke-width yalnız sahne kökünde değişir', () => {
        // Kök dışındaki stroke-width değerleri ölçekli parçalara (ilerleme çubuğu, QR) izinli;
        // ama 8'den kalın çizgi stil dışıdır.
        for (const m of html.matchAll(/stroke-width="([\d.]+)"/g)) {
          expect(Number(m[1])).toBeLessThanOrEqual(8)
        }
      })
    })
  }
})
