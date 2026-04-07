import { logger } from '@/lib/logger'

/**
 * Wraps an API route handler with performance logging.
 * Logs a warning when a route takes longer than 1 second.
 * Adds a `Server-Timing` header for client-side observability.
 *
 * Usage:
 * ```ts
 * export const GET = withPerfLogging('admin/trainings', async (request) => {
 *   // ... handler code
 * })
 * ```
 */
export function withPerfLogging<
  TArgs extends [Request, ...unknown[]],
  THandler extends (...args: TArgs) => Promise<Response>,
>(routeName: string, handler: THandler): THandler {
  return (async (...args: TArgs) => {
    const start = performance.now()
    const response = await handler(...args)
    const duration = Math.round(performance.now() - start)

    if (duration > 1000) {
      logger.warn('SlowAPI', `${routeName} ${duration}ms surdu`, {
        route: routeName,
        duration,
        status: response.status,
      })
    }

    const newHeaders = new Headers(response.headers)
    newHeaders.set('Server-Timing', `api;dur=${duration}`)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  }) as unknown as THandler
}
