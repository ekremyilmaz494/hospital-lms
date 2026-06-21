import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { POINTS, GAMI_EVENT_RATE_LIMIT } from '@/lib/gamification/constants'
import { verifyEvent, type GamificationEventType } from '@/lib/gamification/verify'
import { seedDailyReviewForTraining } from '@/lib/gamification/seeding'
import { evaluateBadges, type NewBadge } from '@/lib/gamification/badges'

const eventSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['exam_pass', 'training_complete', 'feedback_submit']),
  refId: z.string().uuid(),
})

const POINTS_BY_TYPE: Record<GamificationEventType, number> = {
  exam_pass: POINTS.examPass,
  training_complete: POINTS.trainingComplete,
  feedback_submit: POINTS.feedbackSubmit,
}

// Bu olaylar "öğrenilen içerik" → doğrulanınca Leitner havuzuna seed edilir.
const SEED_TYPES = new Set<GamificationEventType>(['exam_pass', 'training_complete'])

/** İşlenmiş / kredisiz idempotent yanıt. */
function alreadyProcessed() {
  return jsonResponse({ ok: true, pointsAwarded: 0, newBadges: [] as NewBadge[] })
}

/**
 * POST /api/staff/gamification/event — Puan kazandıran olay bildirimi.
 *
 * - **Idempotent:** Aynı `eventId` tekrar gelirse kredi BİR kez (`PointLedger.dedupKey` unique).
 * - **Anti-cheat:** Olay SUNUCUDA kendi kaydından doğrulanır (`verifyEvent`); doğrulanamazsa 422,
 *   ledger'a YAZILMAZ. refId+userId cross-check → başka kullanıcının kaydı sayılamaz.
 * - Doğrulanan `exam_pass`/`training_complete` o eğitimin sorularını Leitner havuzuna seed eder.
 */
export const POST = withStaffRoute(
  async ({ request, dbUser, organizationId }) => {
    const allowed = await checkRateLimit(
      `gami-event:${dbUser.id}`,
      GAMI_EVENT_RATE_LIMIT.max,
      GAMI_EVENT_RATE_LIMIT.windowSeconds,
    )
    if (!allowed) return errorResponse('Çok fazla istek, lütfen sonra tekrar deneyin', 429)

    const body = await parseBody(request)
    if (!body) return errorResponse('Geçersiz istek gövdesi')
    const parsed = eventSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.message)
    const { eventId, type, refId } = parsed.data
    const dedupKey = `${type}:${eventId}`

    // 1) Idempotency — bu eventId daha önce işlendiyse yeni kredi yok.
    const existing = await prisma.pointLedger.findUnique({ where: { dedupKey }, select: { id: true } })
    if (existing) return alreadyProcessed()

    // 2) SUNUCU DOĞRULAMASI (anti-cheat) — mobilin iddiasına güvenme.
    const { verified, trainingId } = await verifyEvent(type, refId, dbUser.id, organizationId)
    if (!verified) return errorResponse('Olay doğrulanamadı', 422)

    // 3) Kredi (append-only; dedupKey unique → çift-kredi imkansız).
    // perf-check: no-cache-invalidation — oyunlaştırma puanları server-side cache'lenmez;
    // summary GET her istekte taze SUM(point_ledger) okur (yalnız HTTP Cache-Control).
    const points = POINTS_BY_TYPE[type]
    try {
      await prisma.pointLedger.create({
        data: { userId: dbUser.id, organizationId, eventType: type, refId, points, dedupKey },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return alreadyProcessed() // eşzamanlı aynı eventId → idempotent
      }
      throw err
    }

    // 4-5) Yan etkiler (seeding + rozet) — best-effort; hata krediyi/isteği bozmaz.
    let newBadges: NewBadge[] = []
    try {
      if (trainingId && SEED_TYPES.has(type)) {
        await seedDailyReviewForTraining(dbUser.id, organizationId, trainingId)
      }
      newBadges = await evaluateBadges(dbUser.id, organizationId)
    } catch (sideErr) {
      logger.warn('gami-event', 'Yan etki (seed/rozet) başarısız', {
        userId: dbUser.id,
        type,
        error: sideErr instanceof Error ? sideErr.message : String(sideErr),
      })
    }

    return jsonResponse({ ok: true, pointsAwarded: points, newBadges })
  },
  { requireOrganization: true },
)
