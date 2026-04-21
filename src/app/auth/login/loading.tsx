// Clinical Editorial palette — login page ile birebir aynı renkler
// Skeleton'dan asıl login'e geçiş yumuşak olsun diye layout da birebir eşlendi.
const INK = '#0a1628'
const CREAM = '#faf7f2'
const RULE = '#e5e0d5'
const GOLD = '#c9a961'
const INK_SOFT = '#5b6478'

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: CREAM }}>
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

      {/* ── LEFT — Dark Editorial Brand Panel (gerçek sayfa ile aynı) ── */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden"
        style={{ background: INK }}
      >
        {/* Radial glow — gerçek sayfadaki ed-pulse efekti */}
        <div
          className="absolute inset-0 z-0 skel-glow"
          style={{ background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${GOLD}1f 0%, transparent 60%)` }}
        />
        {/* Nokta dokusu */}
        <div
          className="absolute inset-0 z-0 opacity-[0.16]"
          style={{
            backgroundImage: `radial-gradient(circle, ${GOLD} 1px, transparent 1px)`,
            backgroundSize: '26px 26px',
          }}
        />

        {/* Content skeleton — 3 zone layout */}
        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16 justify-between">
          {/* Top — masthead */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-sm skel-pulse" style={{ background: GOLD, opacity: 0.3 }} />
            <div className="h-4 w-40 rounded-sm skel-pulse" style={{ background: GOLD, opacity: 0.2 }} />
          </div>

          {/* Middle — hero quote */}
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-sm skel-pulse" style={{ background: GOLD, opacity: 0.25 }} />
            <div className="h-10 w-[85%] rounded-sm skel-pulse" style={{ background: INK_SOFT, opacity: 0.35 }} />
            <div className="h-10 w-[70%] rounded-sm skel-pulse" style={{ background: INK_SOFT, opacity: 0.35 }} />
            <div className="h-3 w-[60%] rounded-sm skel-pulse mt-4" style={{ background: INK_SOFT, opacity: 0.25 }} />
          </div>

          {/* Bottom — footer mark */}
          <div className="h-3 w-32 rounded-sm skel-pulse" style={{ background: GOLD, opacity: 0.2 }} />
        </div>
      </aside>

      {/* ── RIGHT — Form Panel (cream, gerçek sayfa ile aynı) ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-10 lg:px-16">
        <div className="w-full max-w-md space-y-5">
          {/* Heading */}
          <div className="space-y-3 mb-2">
            <div className="h-3 w-20 rounded-sm skel-pulse" style={{ background: RULE, opacity: 0.7 }} />
            <div className="h-8 w-52 rounded-sm skel-pulse" style={{ background: RULE, opacity: 0.8 }} />
            <div className="h-3 w-64 rounded-sm skel-pulse" style={{ background: RULE, opacity: 0.5 }} />
          </div>

          {/* Form fields */}
          <div className="space-y-2 pt-4">
            <div className="h-3 w-16 rounded-sm skel-pulse" style={{ background: RULE, opacity: 0.5 }} />
            <div className="h-[50px] w-full rounded-sm" style={{ background: CREAM, border: `1.5px solid ${RULE}` }} />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-12 rounded-sm skel-pulse" style={{ background: RULE, opacity: 0.5 }} />
            <div className="h-[50px] w-full rounded-sm" style={{ background: CREAM, border: `1.5px solid ${RULE}` }} />
          </div>

          {/* Submit button */}
          <div className="h-[50px] w-full rounded-sm skel-pulse mt-6" style={{ background: INK, opacity: 0.85 }} />

          {/* Bottom link */}
          <div className="h-3 w-40 mx-auto rounded-sm skel-pulse mt-4" style={{ background: RULE, opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}
