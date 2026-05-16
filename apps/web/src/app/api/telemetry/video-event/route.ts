/**
 * Video player telemetry endpoint — client'tan gelen video event'lerini Sentry'e ve
 * structured log'lara yazar. Amaç: "video duraklıyor" intermittent şikayetlerinin
 * gerçek root cause'unu (network buffer underrun, MEDIA_ERR, CDN MISS, vb.)
 * production verisinde ölçmek. Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md Faz 1.
 *
 * Notlar:
 * - withStaffRoute → staff, admin, super_admin (sınav videosu izlemek isteyen herkes)
 * - Rate limit: kullanıcı başına 100 event/dk (heartbeat değil, sadece anomaly event)
 * - `error` ve `stalled` her zaman Sentry'e yazılır; gürültülü event'ler (suspend,
 *   abort, canplay) örnekleme ile gönderilir
 * - GET değil POST olduğu için Cache-Control gerekmez
 */

import { z } from 'zod'
import { withStaffRoute } from '@/lib/api-handler'
import { jsonResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

const VIDEO_EVENT_TYPES = [
  'waiting',
  'canplay',
  'stalled',
  'suspend',
  'abort',
  'error',
  'progress_drop',
] as const

const videoEventSchema = z.object({
  event: z.enum(VIDEO_EVENT_TYPES),
  videoId: z.string().uuid().nullable().optional(),
  currentTime: z.number().nonnegative().nullable().optional(),
  duration: z.number().nonnegative().nullable().optional(),
  readyState: z.number().int().min(0).max(4).nullable().optional(),
  networkState: z.number().int().min(0).max(3).nullable().optional(),
  bufferedEnd: z.number().nonnegative().nullable().optional(),
  effectiveType: z.string().max(20).nullable().optional(),
  downlink: z.number().nullable().optional(),
  rtt: z.number().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  errorCode: z.number().int().min(1).max(4).nullable().optional(),
  errorMessage: z.string().max(500).nullable().optional(),
  timestamp: z.number().int().nullable().optional(),
})

type VideoEvent = z.infer<typeof videoEventSchema>

const ALWAYS_REPORT = new Set(['error', 'stalled'])
const SAMPLED_RATE = 0.2

export const POST = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  const userKey = `video-event:${dbUser.id}`.replace(/[^a-zA-Z0-9:._@-]/g, '_')
  const allowed = await checkRateLimit(userKey, 100, 60)
  if (!allowed) {
    return jsonResponse({ ok: false, reason: 'rate_limited' }, 429)
  }

  const body = await parseBody<VideoEvent>(request)
  if (!body) throw new ApiError('Geçersiz veri', 400)

  const parsed = videoEventSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('Geçersiz veri', 400)
  }

  const event = parsed.data

  const shouldReport = ALWAYS_REPORT.has(event.event) || Math.random() < SAMPLED_RATE
  if (!shouldReport) {
    return jsonResponse({ ok: true, sampled: false })
  }

  const ctx = {
    userId: dbUser.id,
    organizationId,
    videoId: event.videoId ?? null,
    event: event.event,
    currentTime: event.currentTime,
    duration: event.duration,
    readyState: event.readyState,
    networkState: event.networkState,
    bufferedEnd: event.bufferedEnd,
    effectiveType: event.effectiveType,
    downlink: event.downlink,
    rtt: event.rtt,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    userAgent: event.userAgent?.slice(0, 200),
  }

  if (event.event === 'error') {
    logger.error('video-telemetry', `MEDIA_ERR code=${event.errorCode ?? '?'}`, ctx)
  } else if (event.event === 'stalled' || event.event === 'waiting') {
    logger.warn('video-telemetry', `playback ${event.event}`, ctx)
  } else {
    logger.info('video-telemetry', `playback ${event.event}`, ctx)
  }

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nextjs')
      Sentry.addBreadcrumb({
        category: 'video',
        level: event.event === 'error' ? 'error' : event.event === 'stalled' ? 'warning' : 'info',
        message: `video-${event.event}`,
        data: ctx,
      })
      if (event.event === 'error' || event.event === 'stalled') {
        Sentry.captureMessage(`video-${event.event}`, {
          level: event.event === 'error' ? 'error' : 'warning',
          tags: {
            video_event: event.event,
            error_code: event.errorCode?.toString() ?? 'n/a',
            effective_type: event.effectiveType ?? 'n/a',
          },
          extra: ctx,
        })
      }
    } catch {
      // Sentry yüklenemezse sessiz geç — telemetry zaten best-effort
    }
  }

  return jsonResponse({ ok: true, sampled: true })
}, { writeGuard: false })
