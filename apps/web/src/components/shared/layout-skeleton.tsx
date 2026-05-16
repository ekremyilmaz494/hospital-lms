/** Layout iskelet bileşeni — auth yüklenirken beyaz ekran yerine gösterilir. */

interface LayoutSkeletonProps {
  variant: 'admin' | 'staff' | 'super-admin'
}

function PulseBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ''}`}
      style={{ background: 'var(--color-surface-hover)', ...style }}
    />
  )
}

export function LayoutSkeleton({ variant }: LayoutSkeletonProps) {
  const showSidebar = variant !== 'staff'

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar rail */}
      {showSidebar && (
        <div
          className="fixed left-0 top-0 h-screen"
          style={{
            width: 72,
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
          }}
        >
          <div className="flex flex-col items-center gap-4 pt-5">
            <PulseBlock style={{ width: 40, height: 40, borderRadius: 12 }} />
            <div className="mt-4 flex flex-col items-center gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <PulseBlock key={i} style={{ width: 36, height: 36, borderRadius: 10 }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ marginLeft: showSidebar ? 72 : 0 }}>
        {/* Topbar */}
        <div
          className="flex items-center justify-between px-8"
          style={{
            height: 64,
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <PulseBlock style={{ width: 160, height: 20 }} />
          <div className="flex items-center gap-3">
            <PulseBlock style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <PulseBlock style={{ width: 100, height: 16 }} />
          </div>
        </div>

        {/* Content area */}
        <div className="p-8 space-y-6">
          {/* Title */}
          <PulseBlock style={{ width: 240, height: 28 }} />

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <PulseBlock key={i} style={{ height: 88 }} />
            ))}
          </div>

          {/* Content blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PulseBlock style={{ height: 260 }} />
            <PulseBlock style={{ height: 260 }} />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav for staff */}
      {variant === 'staff' && (
        <div
          className="fixed bottom-0 left-0 right-0 md:hidden"
          style={{
            height: 64,
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-around pt-3">
            {Array.from({ length: 4 }, (_, i) => (
              <PulseBlock key={i} style={{ width: 36, height: 36, borderRadius: 10 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
