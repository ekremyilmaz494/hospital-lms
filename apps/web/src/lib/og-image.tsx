import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand'

export const OG_SIZE = { width: 1200, height: 630 }

// ImageResponse CSS değişkeni okumaz; değerler tokens.css'teki --site-* ile aynı tutulur.
const INK = '#0f172a'
const INK_SOFT = '#475569'
const BG = '#f1f5f9'
const BRAND_600 = '#0d9668'
const BRAND_700 = '#087a54'

// Logo işaretindeki nabız çizgisi (components/brand/LogoMark.tsx ile aynı geometri).
const PULSE_MARK = 'M 8 34 L 20 34 L 23 28 L 26 40 L 30 12 L 34 52 L 38 28 L 42 34 L 56 34'
const NOVA = 'M 30 5 L 31.6 10.4 L 37 12 L 31.6 13.6 L 30 19 L 28.4 13.6 L 23 12 L 28.4 10.4 Z'
// Alt kenar boyunca uzanan imza EKG çizgisi (1200 genişlik).
const PULSE_WIDE =
  'M 0 40 L 610 40 L 632 22 L 652 58 L 676 4 L 700 76 L 722 22 L 744 40 L 1200 40'

export interface OgImageInput {
  title: string
  subtitle: string
}

/**
 * Pazarlama sayfaları için 1200×630 paylaşım görseli üretir.
 *
 * Font yerel TTF'tir (`public/fonts/LiberationSans-*`): ImageResponse woff2 okumaz,
 * build sırasında Google Fonts'a çıkılmaz (on-prem kapalı ağda da üretilebilsin) ve
 * Liberation Sans Türkçe karakterleri (ğ ş ı İ) kapsar.
 */
export async function renderOgImage({ title, subtitle }: OgImageInput): Promise<ImageResponse> {
  const fontDir = join(process.cwd(), 'public', 'fonts')
  const [bold, regular] = await Promise.all([
    readFile(join(fontDir, 'LiberationSans-Bold.ttf')),
    readFile(join(fontDir, 'LiberationSans-Regular.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: '72px 80px 0',
          fontFamily: 'Liberation Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="2" y="2" width="60" height="60" rx="16" fill={BRAND_700} />
            <path
              d={PULSE_MARK}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d={NOVA} fill="#ffffff" />
          </svg>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
            {BRAND.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.08,
              color: INK,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.35, color: INK_SOFT }}>{subtitle}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 28 }}>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: BRAND_700 }}>{BRAND.domain}</div>
          <svg width="1200" height="80" viewBox="0 0 1200 80" style={{ marginLeft: -80 }}>
            <path
              d={PULSE_WIDE}
              fill="none"
              stroke={BRAND_600}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Liberation Sans', data: bold, weight: 700, style: 'normal' },
        { name: 'Liberation Sans', data: regular, weight: 400, style: 'normal' },
      ],
    },
  )
}
