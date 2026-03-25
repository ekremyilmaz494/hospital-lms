export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Yükleniyor">
      <div className="flex flex-col items-center gap-4">
        {/* Animated spinner — pure CSS */}
        <div className="relative h-12 w-12">
          <div
            className="absolute inset-0 animate-spin rounded-full border-[3px]"
            style={{
              borderColor: 'var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              animationDuration: '0.8s',
            }}
          />
          <div
            className="absolute inset-1.5 rounded-full border-[3px]"
            style={{
              borderColor: 'transparent',
              borderTopColor: 'var(--color-accent)',
              animationDuration: '1.2s',
              animationName: 'spin',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDirection: 'reverse',
            }}
          />
        </div>

        {/* Pulsing text — CSS animate-pulse */}
        <p
          className="animate-pulse text-sm font-medium"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Yükleniyor...
        </p>

        {/* Animated dots — staggered CSS pulse */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                background: 'var(--color-primary)',
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
