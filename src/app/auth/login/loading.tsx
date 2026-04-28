// Klinova palette — login page (page.tsx K objesi) ile birebir aynı renkler.
// Skeleton'dan asıl login'e geçiş yumuşak olsun diye layout da birebir eşlendi.
// Eski Clinical Editorial paleti (cream/gold/navy) PR #56'da Aurora monochrome'a
// geçirildi; bu fallback güncellenmediği için landing→login geçişinde eski
// tasarım flash ediyordu.
const HERO_INK = '#1c1917'        // Sol panel deep ink
const HERO_INK_SOFT = '#292524'   // Hero gradient orta ton
const BG = '#fafaf9'              // Sağ panel zemin (--k-bg)
const BORDER = '#e7e5e4'          // Border
const PRIMARY = '#0d9668'         // Emerald accent
const PRIMARY_DEEP = '#087a54'    // Aurora blob koyu
const TEXT_MUTED = '#78716c'

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
      <style>{`
        @keyframes ed-shimmer {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        @keyframes ed-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        .skel-pulse { animation: ed-shimmer 1.8s ease-in-out infinite; }
        .skel-glow { animation: ed-glow 6s ease-in-out infinite; }
      `}</style>

      {/* ── LEFT — Aurora monochrome brand panel (gerçek sayfa ile aynı) ── */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${HERO_INK} 0%, ${HERO_INK_SOFT} 55%, ${HERO_INK} 100%)` }}
      >
        {/* Aurora emerald blob — gerçek sayfadaki radial glow */}
        <div
          className="absolute inset-0 z-0 skel-glow"
          style={{ background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${PRIMARY}33 0%, transparent 60%)` }}
        />
        <div
          className="absolute inset-0 z-0 opacity-40 skel-glow"
          style={{ background: `radial-gradient(circle at 25% 30%, ${PRIMARY_DEEP}55 0%, transparent 50%)` }}
        />

        {/* Content skeleton — 3 zone layout */}
        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16 justify-between">
          {/* Top — masthead */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md skel-pulse" style={{ background: PRIMARY, opacity: 0.35 }} />
            <div className="h-4 w-40 rounded-sm skel-pulse" style={{ background: '#fafaf9', opacity: 0.25 }} />
          </div>

          {/* Middle — hero quote */}
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-sm skel-pulse" style={{ background: PRIMARY, opacity: 0.3 }} />
            <div className="h-10 w-[85%] rounded-sm skel-pulse" style={{ background: '#fafaf9', opacity: 0.18 }} />
            <div className="h-10 w-[70%] rounded-sm skel-pulse" style={{ background: '#fafaf9', opacity: 0.18 }} />
            <div className="h-3 w-[60%] rounded-sm skel-pulse mt-4" style={{ background: '#fafaf9', opacity: 0.14 }} />
          </div>

          {/* Bottom — footer mark */}
          <div className="h-3 w-32 rounded-sm skel-pulse" style={{ background: '#fafaf9', opacity: 0.18 }} />
        </div>
      </aside>

      {/* ── RIGHT — Form panel (gerçek sayfa ile aynı) ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-10 lg:px-16">
        <div className="w-full max-w-md space-y-5">
          {/* Heading */}
          <div className="space-y-3 mb-2">
            <div className="h-3 w-20 rounded-sm skel-pulse" style={{ background: BORDER, opacity: 0.7 }} />
            <div className="h-8 w-52 rounded-sm skel-pulse" style={{ background: BORDER, opacity: 0.8 }} />
            <div className="h-3 w-64 rounded-sm skel-pulse" style={{ background: BORDER, opacity: 0.5 }} />
          </div>

          {/* Form fields */}
          <div className="space-y-2 pt-4">
            <div className="h-3 w-16 rounded-sm skel-pulse" style={{ background: BORDER, opacity: 0.5 }} />
            <div className="h-[50px] w-full rounded-md" style={{ background: '#ffffff', border: `1.5px solid ${BORDER}` }} />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-12 rounded-sm skel-pulse" style={{ background: BORDER, opacity: 0.5 }} />
            <div className="h-[50px] w-full rounded-md" style={{ background: '#ffffff', border: `1.5px solid ${BORDER}` }} />
          </div>

          {/* Submit button — emerald primary */}
          <div className="h-[50px] w-full rounded-md skel-pulse mt-6" style={{ background: PRIMARY, opacity: 0.85 }} />

          {/* Bottom link */}
          <div className="h-3 w-40 mx-auto rounded-sm skel-pulse mt-4" style={{ background: BORDER, opacity: 0.5, color: TEXT_MUTED }} />
        </div>
      </div>
    </div>
  )
}
