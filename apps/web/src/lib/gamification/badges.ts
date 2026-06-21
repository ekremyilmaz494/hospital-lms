/**
 * Rozet motoru — oyunlaştırma Faz 2.
 *
 * `Badge` global katalog; `thresholdJson` kazanım koşulunu tanımlar. Puan/streak/event
 * değiştikçe `evaluateBadges` çağrılır; yeni karşılanan rozetler idempotent kazandırılır
 * (`UserBadge` PK `[userId,badgeId]` + `createMany skipDuplicates` → çift earn imkansız).
 */

import { prisma } from '@/lib/prisma'

export interface NewBadge {
  id: string // badge.code (mobil bunu kullanır)
  tier: string
  icon: string
}

interface ThresholdContext {
  points: number
  streak: { current: number; longest: number } | null
  countByType: Map<string, number>
}

/** Bir rozetin eşik koşulu sağlandı mı? thresholdJson: { type, value, eventType? }. */
export function meetsThreshold(threshold: unknown, ctx: ThresholdContext): boolean {
  const t = threshold as { type?: string; value?: number; eventType?: string } | null
  if (!t || typeof t.value !== 'number') return false
  switch (t.type) {
    case 'points':
      return ctx.points >= t.value
    case 'streak_current':
      return (ctx.streak?.current ?? 0) >= t.value
    case 'streak_longest':
      return (ctx.streak?.longest ?? 0) >= t.value
    case 'event_count':
      return (ctx.countByType.get(t.eventType ?? '') ?? 0) >= t.value
    default:
      return false
  }
}

/**
 * Kullanıcının yeni hak ettiği rozetleri kazandırır ve listesini döner.
 * Hiç yeni rozet yoksa boş dizi. Idempotent (createMany skipDuplicates).
 */
export async function evaluateBadges(userId: string, organizationId: string): Promise<NewBadge[]> {
  const [agg, streak, catalog, earned, counts] = await Promise.all([
    prisma.pointLedger.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.userStreak.findUnique({ where: { userId }, select: { current: true, longest: true } }),
    prisma.badge.findMany({
      where: { isActive: true },
      select: { id: true, code: true, tier: true, icon: true, thresholdJson: true },
    }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.pointLedger.groupBy({ by: ['eventType'], where: { userId }, _count: { _all: true } }),
  ])

  const points = agg._sum.points ?? 0
  const earnedSet = new Set(earned.map((e) => e.badgeId))
  const countByType = new Map(counts.map((c) => [c.eventType, c._count._all]))
  const ctx: ThresholdContext = { points, streak, countByType }

  const toEarn = catalog.filter((b) => !earnedSet.has(b.id) && meetsThreshold(b.thresholdJson, ctx))
  if (toEarn.length === 0) return []

  await prisma.userBadge.createMany({
    data: toEarn.map((b) => ({ userId, badgeId: b.id, organizationId })),
    skipDuplicates: true,
  })
  return toEarn.map((b) => ({ id: b.code, tier: b.tier, icon: b.icon }))
}
