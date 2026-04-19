import * as Sentry from '@sentry/nextjs'

const sharedBeforeSend: Sentry.NodeOptions['beforeSend'] = (event) => {
  if (event.request?.data) {
    const data = event.request.data as Record<string, unknown>
    const sensitiveKeys = ['password', 'token', 'tcNo', 'tcKimlikNo', 'creditCard', 'phone', 'email']
    for (const key of sensitiveKeys) {
      if (key in data) data[key] = '[REDACTED]'
    }
  }
  if (event.request?.headers) {
    const headers = { ...event.request.headers }
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
    for (const key of sensitiveHeaders) {
      if (key in headers) headers[key] = '[REDACTED]'
    }
    event.request.headers = headers
  }
  return event
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: process.env.NODE_ENV === 'development',
      beforeSend: sharedBeforeSend,
    })
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: process.env.NODE_ENV === 'development',
      beforeSend: sharedBeforeSend,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
