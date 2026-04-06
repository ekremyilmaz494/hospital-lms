'use client'

/**
 * Global error boundary — tum uygulamada yakalanmayan hatalari yakalar.
 * Root layout dahil hatalari handle eder.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Sentry'ye hata gonder (paket yuklendiginde aktif olacak)
  if (typeof window !== 'undefined') {
    // Dinamik import — @sentry/nextjs paketi yuklenmemisse sessizce gecer
    const sentryModule = '@sentry/nextjs'
    import(/* webpackIgnore: true */ sentryModule)
      .then((Sentry: { captureException: (e: Error) => void }) => {
        Sentry.captureException(error)
      })
      .catch(() => {
        // @sentry/nextjs paketi henuz yuklenmemis
      })
  }

  return (
    <html lang="tr">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '1.75rem',
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Bir hata olustu
          </h1>
          <p
            style={{
              color: '#64748b',
              maxWidth: 480,
              marginBottom: '2rem',
              lineHeight: 1.6,
            }}
          >
            Beklenmeyen bir hata meydana geldi. Sorun devam ederse lutfen sistem yoneticinizle iletisime gecin.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '1.5rem',
                fontFamily: 'monospace',
              }}
            >
              Hata kodu: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#0d9668',
              color: '#fff',
              border: 'none',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  )
}
