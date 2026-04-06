// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring — %10 oraninda trace
  tracesSampleRate: 0.1,

  // Debug mode sadece development'ta
  debug: process.env.NODE_ENV === 'development',

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

    // Request header'lardan auth bilgilerini temizle
    if (event.request?.headers) {
      const headers = { ...event.request.headers }
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
      for (const key of sensitiveHeaders) {
        if (key in headers) {
          headers[key] = '[REDACTED]'
        }
      }
      event.request.headers = headers
    }

    return event
  },
})
