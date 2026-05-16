import type { PrismaClient } from '@/generated/prisma/client'

interface ResolveRequiredPointsParams {
  prisma: PrismaClient
  periodId: string
  organizationId: string
  userId: string
  userTitle: string | null
  periodFallback: number
}

/**
 * Bir personel için geçerli SMG hedef puanını hesaplar.
 * Öncelik sırası:
 *   1. Kişiye özel SmgTarget (userId eşleşen)
 *   2. Unvana özel SmgTarget (unvan eşleşen, userId=null)
 *   3. Dönem varsayılanı SmgTarget (unvan=null, userId=null)
 *   4. period.requiredPoints (legacy fallback)
 */
export async function resolveRequiredPoints(
  params: ResolveRequiredPointsParams
): Promise<number> {
  const { prisma, periodId, organizationId, userId, userTitle, periodFallback } = params

  const [personal, byUnvan, defaultTarget] = await Promise.all([
    prisma.smgTarget.findFirst({
      where: { periodId, organizationId, userId },
      select: { requiredPoints: true },
    }),
    userTitle
      ? prisma.smgTarget.findFirst({
          where: { periodId, organizationId, unvan: userTitle, userId: null },
          select: { requiredPoints: true },
        })
      : Promise.resolve(null),
    prisma.smgTarget.findFirst({
      where: { periodId, organizationId, unvan: null, userId: null },
      select: { requiredPoints: true },
    }),
  ])

  if (personal) return personal.requiredPoints
  if (byUnvan) return byUnvan.requiredPoints
  if (defaultTarget) return defaultTarget.requiredPoints
  return periodFallback
}

/**
 * Toplu hedef çözümleme — denetim raporu gibi N kullanıcı için tek sefer fetch.
 * N+1 sorunu önlemek için tüm dönem targetlarını bir kez çekip bellekte resolve eder.
 */
export async function resolveRequiredPointsBulk(params: {
  prisma: PrismaClient
  periodId: string
  organizationId: string
  periodFallback: number
  users: Array<{ id: string; title: string | null }>
}): Promise<Map<string, number>> {
  const { prisma, periodId, organizationId, periodFallback, users } = params

  const targets = await prisma.smgTarget.findMany({
    where: { periodId, organizationId },
    select: { unvan: true, userId: true, requiredPoints: true },
  })

  const personalMap = new Map<string, number>()
  const unvanMap = new Map<string, number>()
  let defaultPoints: number | null = null

  for (const t of targets) {
    if (t.userId) {
      personalMap.set(t.userId, t.requiredPoints)
    } else if (t.unvan) {
      unvanMap.set(t.unvan, t.requiredPoints)
    } else {
      defaultPoints = t.requiredPoints
    }
  }

  const result = new Map<string, number>()
  for (const user of users) {
    const personal = personalMap.get(user.id)
    if (personal !== undefined) {
      result.set(user.id, personal)
      continue
    }
    const byUnvan = user.title ? unvanMap.get(user.title) : undefined
    if (byUnvan !== undefined) {
      result.set(user.id, byUnvan)
      continue
    }
    result.set(user.id, defaultPoints ?? periodFallback)
  }
  return result
}
