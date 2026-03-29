const IS_DEV = process.env.NODE_ENV === 'development'

type Level = 'info' | 'warn' | 'error'

interface LogOptions {
  /** Optional request ID for distributed tracing */
  requestId?: string
}

function log(level: Level, tag: string, message: string, extra?: unknown, options?: LogOptions) {
  if (IS_DEV) {
    const reqIdPart = options?.requestId ? ` [req:${options.requestId}]` : ''
    const prefix = `[${level.toUpperCase()}] [${tag}]${reqIdPart}`
    if (level === 'error') console.error(prefix, message, extra ?? '')
    else if (level === 'warn') console.warn(prefix, message, extra ?? '')
    else console.log(prefix, message, extra ?? '')
    return
  }

  // Production: structured JSON for Vercel log explorer
  const entry: Record<string, unknown> = { level, tag, msg: message, ts: new Date().toISOString() }
  if (extra !== undefined) entry.extra = extra
  if (options?.requestId) entry.requestId = options.requestId
  console[level === 'info' ? 'log' : level](JSON.stringify(entry))
}

export const logger = {
  info: (tag: string, message: string, extra?: unknown, options?: LogOptions) => log('info', tag, message, extra, options),
  warn: (tag: string, message: string, extra?: unknown, options?: LogOptions) => log('warn', tag, message, extra, options),
  error: (tag: string, message: string, extra?: unknown, options?: LogOptions) => log('error', tag, message, extra, options),
}
