import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'

/** Feature flag names matching SubscriptionPlan boolean columns */
export type FeatureName =
  | 'scormSupport'
  | 'hisIntegration'
  | 'advancedReports'
  | 'ssoSupport'
  | 'competencyModule'
  | 'accreditationModule'
  | 'bulkImport'
  | 'customCertificates'

/** Numeric limit names matching SubscriptionPlan columns */
export type LimitName = 'maxStaff' | 'maxTrainings' | 'maxStorageGb'

export interface LimitCheckResult {
  allowed: boolean
  current: number
  max: number
}

/** Maps FeatureName → SubscriptionPlan column key */
const FEATURE_TO_COLUMN: Record<FeatureName, string> = {
  scormSupport: 'hasScormSupport',
  hisIntegration: 'hasHisIntegration',
  advancedReports: 'hasAdvancedReports',
  ssoSupport: 'hasSsoSupport',
  competencyModule: 'hasCompetencyModule',
  accreditationModule: 'hasAccreditationModule',
  bulkImport: 'hasBulkImport',
  customCertificates: 'hasCustomCertificates',
}

const PLAN_CACHE_PREFIX = 'feature-gate:plan:'
const PLAN_CACHE_TTL = 300 // 5 dakika

/**
 * Organizasyonun aktif abonelik planini getirir (Redis cache ile).
 * Plan bulunamazsa null doner.
 */
async function getOrganizationPlan(organizationId: string) {
  const cacheKey = `${PLAN_CACHE_PREFIX}${organizationId}`

  // Once cache'e bak
  const cached = await getCached<Record<string, unknown>>(cacheKey)
  if (cached) return cached

  // DB'den cek: organizasyonun aktif aboneligi uzerinden plani getir
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  })

  if (!subscription?.plan) return null

  const plan = subscription.plan as unknown as Record<string, unknown>

  // Cache'e yaz
  await setCached(cacheKey, plan, PLAN_CACHE_TTL)

  return plan
}

/**
 * Belirtilen ozelligin organizasyonun planinda aktif olup olmadigini kontrol eder.
 * Plan bulunamazsa veya ozellik kapaliysa `false` doner.
 */
export async function checkFeature(
  organizationId: string,
  feature: FeatureName
): Promise<boolean> {
  const plan = await getOrganizationPlan(organizationId)
  if (!plan) return false

  const column = FEATURE_TO_COLUMN[feature]
  return plan[column] === true
}

/**
 * Organizasyonun mevcut kullanimini plan limitiyle karsilastirir.
 * `allowed` true ise limit asimina ulasilmamistir.
 */
export async function checkLimit(
  organizationId: string,
  limit: LimitName
): Promise<LimitCheckResult> {
  const plan = await getOrganizationPlan(organizationId)

  // Plan yoksa sinirsiz kabul et (fallback)
  if (!plan) {
    return { allowed: true, current: 0, max: Infinity }
  }

  const max = (plan[limit] as number | null) ?? Infinity

  // Sinirsiz plan (null = limitsiz)
  if (max === Infinity) {
    return { allowed: true, current: 0, max: Infinity }
  }

  let current = 0

  if (limit === 'maxStaff') {
    current = await prisma.user.count({
      where: {
        organizationId,
        role: 'staff',
        isActive: true,
      },
    })
  } else if (limit === 'maxTrainings') {
    current = await prisma.training.count({
      where: { organizationId },
    })
  } else if (limit === 'maxStorageGb') {
    // Depolama hesaplamasi karmasik — su an icin sadece plan limitini dondur
    current = 0
  }

  return {
    allowed: current < max,
    current,
    max,
  }
}

/**
 * Organizasyonun plan cache'ini temizler.
 * Plan degisikligi sonrasi cagirilmalidir.
 */
export async function invalidatePlanCache(organizationId: string): Promise<void> {
  const { invalidateCache } = await import('@/lib/redis')
  await invalidateCache(`${PLAN_CACHE_PREFIX}${organizationId}`)
}
