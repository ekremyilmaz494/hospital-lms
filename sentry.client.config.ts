// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — %10 oraninda trace
  tracesSampleRate: 0.1,

  // Debug mode sadece development'ta
  debug: process.env.NODE_ENV === 'development',

  // Replay session — production'da hata aninda kayit
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

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
