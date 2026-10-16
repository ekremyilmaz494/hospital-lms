/**
 * Site illüstrasyonlarını PNG olarak önizler (tasarım onayı + görsel regresyon gözü).
 *
 *   pnpm exec tsx scripts/preview-illustrations.tsx <çıktı-klasörü> [sahne-adı ...]
 *
 * Her sahne için iki görüntü üretir: açık zemin ve koyu bant (`.s-band`). Sunucu,
 * veritabanı veya ağ gerekmez: sahneler renderToStaticMarkup ile HTML'e basılır,
 * tokens.css + site.css satır içi eklenir, Chromium ile ekran görüntüsü alınır.
 * Hareket kapalı (son hâl) görüntülenir.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { ILLUSTRATIONS, type IllustrationName } from '../src/components/site/illustrations'

const outDir = resolve(process.argv[2] ?? 'illustration-preview')
const only = process.argv.slice(3) as IllustrationName[]
const names = (only.length ? only : Object.keys(ILLUSTRATIONS)) as IllustrationName[]

const css = ['src/styles/tokens.css', 'src/styles/site.css'].map((f) => readFileSync(f, 'utf8')).join('\n')

function page(name: IllustrationName, band: boolean): string {
  const Scene = ILLUSTRATIONS[name]
  const svg = renderToStaticMarkup(<Scene />)
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${css}
    body{margin:0;background:${band ? 'var(--site-band)' : 'var(--site-bg)'};}
    .frame{width:720px;padding:40px;box-sizing:border-box}
  </style></head><body><div class="frame${band ? ' s-band' : ''}">${svg}</div></body></html>`
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  // PREVIEW_CHROME=1: Playwright'ın indirilmiş Chromium'u yerine kurulu Chrome.
  const browser = await chromium.launch(process.env.PREVIEW_CHROME ? { channel: 'chrome' } : {})
  const ctx = await browser.newContext({ viewport: { width: 720, height: 600 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const tab = await ctx.newPage()
  for (const name of names) {
    if (!ILLUSTRATIONS[name]) throw new Error(`Bilinmeyen sahne: ${name}`)
    for (const band of [false, true]) {
      const html = page(name, band)
      const htmlPath = join(outDir, `${name}${band ? '.band' : ''}.html`)
      writeFileSync(htmlPath, html)
      await tab.goto(`file://${htmlPath}`)
      await tab.locator('.frame').screenshot({ path: join(outDir, `${name}${band ? '.band' : ''}.png`) })
    }
    process.stdout.write(`✓ ${name}\n`)
  }
  await browser.close()
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
  process.exit(1)
})
