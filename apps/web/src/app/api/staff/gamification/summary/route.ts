import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { STREAK_FREEZES_DEFAULT } from '@/lib/gamification/constants'
import { computeAtRisk } from '@/lib/gamification/streak'

const CACHE_CONTROL = 'private, max-age=30, stale-while-revalidate=60'

/**
 * GET /api/staff/gamification/summary — Puan + streak + rozet özeti.
 *
 * `points` = SUM(point_ledger) → append-only olduğu için ASLA azalmaz.
 * `badges` = global katalog + kullanıcının kazanım durumu. Profil/dashboard widget'ı besler.
 */
export const GET = withStaffRoute(
  async ({ dbUser }) => {
    const [agg, streak, catalog, earned] = await Promise.all([
      prisma.pointLedger.aggregate({ where: { userId: dbUser.id }, _sum: { points: true } }),
      prisma.userStreak.findUnique({
        where: { userId: dbUser.id },
        select: { current: true, longest: true, freezesLeft: true, lastActiveDate: true },
      }),
      prisma.badge.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, code: true, tier: true, icon: true },
      }),
      prisma.userBadge.findMany({
        where: { userId: dbUser.id },
        select: { badgeId: true, earnedAt: true },
      }),
    ])

    const points = agg._sum.points ?? 0
    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]))

    return jsonResponse(
      {
        points,
        streak: {
          current: streak?.current ?? 0,
          longest: streak?.longest ?? 0,
          freezesLeft: streak?.freezesLeft ?? STREAK_FREEZES_DEFAULT,
          atRisk: computeAtRisk(streak ?? null),
        },
        badges: catalog.map((b) => ({
          id: b.code,
          tier: b.tier,
          icon: b.icon,
          earned: earnedMap.has(b.id),
          earnedAt: earnedMap.get(b.id) ?? undefined,
        })),
      },
      200,
      { 'Cache-Control': CACHE_CONTROL },
    )
  },
  { requireOrganization: true },
)
