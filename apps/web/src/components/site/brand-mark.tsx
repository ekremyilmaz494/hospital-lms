/**
 * KlinoVax işareti: yeşil kare içinde nabız çizgisi + nova yıldızı.
 * `components/brand/LogoMark.tsx` ile aynı geometri; istemci JS'i ve framer-motion
 * gerektirmeyen statik sürüm (site kabuğu Server Component kalsın).
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className="s-brandmark">
      <rect x="2" y="2" width="60" height="60" rx="16" className="s-brandmark-bg" />
      <path
        d="M 8 34 L 20 34 L 23 28 L 26 40 L 30 12 L 34 52 L 38 28 L 42 34 L 56 34"
        fill="none"
        className="s-brandmark-fg"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M 30 5 L 31.6 10.4 L 37 12 L 31.6 13.6 L 30 19 L 28.4 13.6 L 23 12 L 28.4 10.4 Z" className="s-brandmark-star" />
    </svg>
  )
}
