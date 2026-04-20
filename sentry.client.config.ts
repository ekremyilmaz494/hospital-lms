// Client-side Sentry init — browser'da her sayfa yuklemesinde calisir.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// DSN yoksa init'i tamamen atla — "kurulu ama ölü" durumu engellemek icin explicit bırakildi.
// Dev mode'da da atla — verbose debug logging + reactComponentAnnotation compile'i yavaslatir.
if (dsn && process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn,

    // Ortam etiketi — Vercel otomatik set eder (production | preview | development)
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

    // Release = deploy SHA'si. Vercel'da NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA otomatik gelir.
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Performance Monitoring — %5 trace (hastane trafigine gore ekonomik)
    tracesSampleRate: 0.05,

    // Debug: dev'de Sentry zaten init edilmiyor (yukarıdaki guard), prod'da kapalı
    debug: false,

    // Replay — session kayit yok, sadece hata aninda kayit
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // KVKK: replay'de tum text maskeli + tum media engellenmis
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],

    // Gurultu filtreleri — production hatalari arasinda kaybolmamak icin
    ignoreErrors: [
      // Browser extension gurultusu
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Ag kopmalari (kullanici tarafi, bize aksiyon lazim degil)
      'Network request failed',
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      'Load failed',
      // Chunk load hatasi — deploy sirasinda eski sekme yeni JS'i cekemez, kullanici yenileyince duzelir
      /ChunkLoadError/,
      /Loading chunk \d+ failed/,
    ],

    // PII filtreleme — KVKK uyumlu
    beforeSend(event) {
      // Request body'den hassas alanlari temizle
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        const sensitiveKeys = ['password', 'token', 'tcNo', 'tcKimlikNo', 'creditCard', 'phone', 'email']
        for (const key of sensitiveKeys) {
          if (key in data) {
            data[key] = '[REDACTED]'
          }
        }
      }

      // Breadcrumb'lardan hassas verileri temizle
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            const data = { ...breadcrumb.data }
            const sensitiveKeys = ['password', 'token', 'tcNo', 'authorization']
            for (const key of sensitiveKeys) {
              if (key in data) {
                data[key] = '[REDACTED]'
              }
            }
            return { ...breadcrumb, data }
          }
          return breadcrumb
        })
      }

      return event
    },

    // URL'lerden hassas query parametrelerini temizle
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'navigation' && breadcrumb.data?.to) {
        const url = breadcrumb.data.to as string
        if (url.includes('token=') || url.includes('password=')) {
          breadcrumb.data.to = url.replace(/([?&])(token|password)=[^&]*/g, '$1$2=[REDACTED]')
        }
      }
      return breadcrumb
    },
  })
}
