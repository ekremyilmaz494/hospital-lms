const IS_DEV = process.env.NODE_ENV === 'development'

type Level = 'info' | 'warn' | 'error'

function log(level: Level, tag: string, message: string, extra?: unknown) {
  if (IS_DEV) {
    const prefix = `[${level.toUpperCase()}] [${tag}]`
    if (level === 'error') console.error(prefix, message, extra ?? '')
    else if (level === 'warn') console.warn(prefix, message, extra ?? '')
    else console.log(prefix, message, extra ?? '')
    return
  }

  // Production: structured JSON for Vercel log explorer
  const entry: Record<string, unknown> = { level, tag, msg: message, ts: new Date().toISOString() }
  if (extra !== undefined) entry.extra = extra
  console[level === 'info' ? 'log' : level](JSON.stringify(entry))
}

export const logger = {
  info: (tag: string, message: string, extra?: unknown) => log('info', tag, message, extra),
  warn: (tag: string, message: string, extra?: unknown) => log('warn', tag, message, extra),
  error: (tag: string, message: string, extra?: unknown) => log('error', tag, message, extra),
}
