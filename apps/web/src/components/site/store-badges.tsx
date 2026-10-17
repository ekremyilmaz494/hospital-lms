import { BRAND } from '@/lib/brand'

/**
 * App Store + Google Play rozetleri (resmî düzen: siyah hap + logo + iki satır).
 * Logolar satır içi SVG; Google Play faset renkleri marka varlığıdır, tema rengi değil.
 */
export function StoreBadges({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={['s-stores', compact && 's-stores-compact', className].filter(Boolean).join(' ')}>
      <a
        href={BRAND.app.appStore}
        target="_blank"
        rel="noopener noreferrer"
        className="s-store"
        aria-label={`${BRAND.name} iOS uygulamasını App Store'dan indir`}
      >
        <svg className="s-store-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 8.16 7.31c1.24.07 2.11.72 2.85.78 1.14-.24 2.23-.9 3.44-.83 1.44.09 2.53.63 3.24 1.65-3.02 1.83-2.28 5.53.72 6.71-.6 1.53-1.38 3.06-2.11 4.35zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        <span className="s-store-text">
          <span className="s-store-sm">Download on the</span>
          <span className="s-store-lg">App Store</span>
        </span>
      </a>
      <a
        href={BRAND.app.googlePlay}
        target="_blank"
        rel="noopener noreferrer"
        className="s-store"
        aria-label={`${BRAND.name} Android uygulamasını Google Play'den indir`}
      >
        <svg className="s-store-ico s-store-ico-gplay" viewBox="0 0 19 22" aria-hidden="true">
          <path d="M0 0 L5.5 11 L0 11 Z" fill="#00d3ff" />
          <path d="M0 22 L5.5 11 L0 11 Z" fill="#00f076" />
          <path d="M0 0 L19 11 L5.5 11 Z" fill="#ff3d47" />
          <path d="M0 22 L19 11 L5.5 11 Z" fill="#ffce00" />
        </svg>
        <span className="s-store-text">
          <span className="s-store-sm s-store-caps">Get it on</span>
          <span className="s-store-lg">Google Play</span>
        </span>
      </a>
    </div>
  )
}
