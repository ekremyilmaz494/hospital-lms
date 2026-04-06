'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

/**
 * Route-level error boundary — sayfa seviyesindeki hatalari yakalar.
 * Layout korunur, sadece sayfa icerigi hata mesaji ile degistirilir.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry'ye hata gonder (paket yuklendiginde aktif olacak)
    // Dinamik import — @sentry/nextjs paketi yuklenmemisse sessizce gecer
    const sentryModule = '@sentry/nextjs'
    import(/* webpackIgnore: true */ sentryModule)
      .then((Sentry: { captureException: (e: Error) => void }) => {
        Sentry.captureException(error)
      })
      .catch(() => {
        // @sentry/nextjs paketi henuz yuklenmemis
      })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}
          >
            <AlertTriangle
              className="h-8 w-8"
              style={{ color: 'var(--color-error)' }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-xl font-semibold">
              Sayfa yuklenirken hata olustu
            </h2>
            <p className="text-sm text-muted-foreground">
              Bu sayfayi yuklerken beklenmeyen bir hata meydana geldi. Lutfen tekrar deneyin veya ana sayfaya donun.
            </p>
          </div>

          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              Hata kodu: {error.digest}
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={() => reset()} variant="default">
              <RotateCcw className="mr-2 h-4 w-4" />
              Tekrar Dene
            </Button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground h-8"
            >
              <Home className="h-4 w-4" />
              Ana Sayfa
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
