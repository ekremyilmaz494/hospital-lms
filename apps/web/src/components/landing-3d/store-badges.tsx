import { BRAND } from '@/lib/brand';

/**
 * App Store + Google Play indirme rozetleri (resmî düzen: siyah hap + logo +
 * iki satır metin). Logolar satır-içi SVG — dış görsel yok, CSP-güvenli, retina-keskin.
 * Landing hero, §5 mobil bölümü ve footer paylaşır. Stiller: landing-3d.css (.l3d-store-*).
 *
 * @param variant  'default' (büyük, hero/section) | 'compact' (footer)
 */
export function StoreBadges({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'compact';
  className?: string;
}) {
  const cls = ['l3d-store-badges', variant === 'compact' ? 'l3d-store-badges-compact' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <a
        href={BRAND.app.appStore}
        target="_blank"
        rel="noopener noreferrer"
        className="l3d-store-badge l3d-store-badge-apple"
        aria-label={`${BRAND.name} iOS uygulamasını App Store'dan indir`}
      >
        <AppleLogo />
        <span className="l3d-store-badge-text">
          <span className="l3d-store-badge-sm">Download on the</span>
          <span className="l3d-store-badge-lg">App Store</span>
        </span>
      </a>

      <a
        href={BRAND.app.googlePlay}
        target="_blank"
        rel="noopener noreferrer"
        className="l3d-store-badge l3d-store-badge-gplay"
        aria-label={`${BRAND.name} Android uygulamasını Google Play'den indir`}
      >
        <GooglePlayLogo />
        <span className="l3d-store-badge-text">
          <span className="l3d-store-badge-sm l3d-store-badge-sm-wide">GET IT ON</span>
          <span className="l3d-store-badge-lg">Google Play</span>
        </span>
      </a>
    </div>
  );
}

/** Apple amblemi (beyaz). */
function AppleLogo() {
  return (
    <svg
      className="l3d-store-badge-ico l3d-store-ico-apple"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 8.16 7.31c1.24.07 2.11.72 2.85.78 1.14-.24 2.23-.9 3.44-.83 1.44.09 2.53.63 3.24 1.65-3.02 1.83-2.28 5.53.72 6.71-.6 1.53-1.38 3.06-2.11 4.35zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/**
 * Google Play "oynat üçgeni" — 4 renk faseti. Dış üçgen köşeleri TL(0,0) / BL(0,22) /
 * tepe R(19,11); sırt orta noktası ML(0,11) ve iç buluşma noktası M(5.5,11) 4 faseti böler.
 */
function GooglePlayLogo() {
  return (
    <svg className="l3d-store-badge-ico l3d-store-ico-gplay" viewBox="0 0 19 22" aria-hidden="true">
      <path d="M0 0 L5.5 11 L0 11 Z" fill="#00d3ff" />
      <path d="M0 22 L5.5 11 L0 11 Z" fill="#00f076" />
      <path d="M0 0 L19 11 L5.5 11 Z" fill="#ff3d47" />
      <path d="M0 22 L19 11 L5.5 11 Z" fill="#ffce00" />
    </svg>
  );
}
