import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'

const SUBSCRIPTION_CACHE_TTL = 120 // 2 dakika
const GRACE_PERIOD_DAYS = 7

export type SubscriptionStatusType = 'trial' | 'active' | 'grace_period' | 'expired' | 'suspended'

export interface SubscriptionCheckResult {
  status: SubscriptionStatusType
  daysLeft: number
  isExpired: boolean
  isGracePeriod: boolean
}

/**
 * Organizasyonun abonelik durumunu kontrol eder.
 * Redis cache kullanir (2 dk TTL).
 */
export async function checkSubscriptionStatus(
  organizationId: string
): Promise<SubscriptionCheckResult> {
  const cacheKey = `sub:status:${organizationId}`

  // Cache'den kontrol
  const cached = await getCached<SubscriptionCheckResult>(cacheKey)
  if (cached) return cached

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  })

  const result = computeSubscriptionStatus(subscription)
  await setCached(cacheKey, result, SUBSCRIPTION_CACHE_TTL)
  return result
}

function computeSubscriptionStatus(
  subscription: { status: string; trialEndsAt: Date | null; expiresAt: Date | null } | null
): SubscriptionCheckResult {
  if (!subscription) {
    return { status: 'expired', daysLeft: 0, isExpired: true, isGracePeriod: false }
  }

  if (subscription.status === 'suspended') {
    return { status: 'suspended', daysLeft: 0, isExpired: true, isGracePeriod: false }
  }

  const now = new Date()

  // Trial durumu
  if (subscription.status === 'trial') {
    const trialEnd = subscription.trialEndsAt
    if (!trialEnd) {
      return { status: 'expired', daysLeft: 0, isExpired: true, isGracePeriod: false }
    }
    return computeExpiryStatus(trialEnd, now)
  }

  // Active abonelik durumu
  const expiresAt = subscription.expiresAt
  if (!expiresAt) {
    // Suresiz aktif abonelik
    return { status: 'active', daysLeft: 9999, isExpired: false, isGracePeriod: false }
  }

  return computeExpiryStatus(expiresAt, now)
}

function computeExpiryStatus(endDate: Date, now: Date): SubscriptionCheckResult {
  const diffMs = endDate.getTime() - now.getTime()
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (daysLeft > 0) {
    return { status: 'active', daysLeft, isExpired: false, isGracePeriod: false }
  }

  // Suresi dolmus — grace period kontrolu
  const daysPastExpiry = Math.abs(daysLeft)
  if (daysPastExpiry <= GRACE_PERIOD_DAYS) {
    return {
      status: 'grace_period',
      daysLeft: GRACE_PERIOD_DAYS - daysPastExpiry,
      isExpired: false,
      isGracePeriod: true,
    }
  }

  return { status: 'expired', daysLeft: 0, isExpired: true, isGracePeriod: false }
}

/**
 * Abonelik limitlerini kontrol eder.
 * Personel veya eğitim oluşturulmadan önce çağrılır.
 * Limit aşılmışsa hata response döner, yoksa null.
 */
export async function checkSubscriptionLimit(
  organizationId: string,
  type: 'staff' | 'training'
): Promise<Response | null> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  })

  // Abonelik yoksa veya plan yoksa — izin ver (henüz setup edilmemiş)
  if (!subscription || !subscription.plan) return null

  // Abonelik durumu kontrol
  if (subscription.status === 'suspended' || subscription.status === 'expired' || subscription.status === 'cancelled') {
    return errorResponse('Aboneliğiniz aktif değil. Lütfen aboneliğinizi yenileyiniz.', 403)
  }

  // Trial süresi dolmuş mu?
  if (subscription.status === 'trial' && subscription.trialEndsAt && new Date(subscription.trialEndsAt) <= new Date()) {
    return errorResponse('Deneme süreniz dolmuştur. Lütfen bir plan satın alınız.', 403)
  }

  const plan = subscription.plan

  if (type === 'staff' && plan.maxStaff) {
    const currentStaff = await prisma.user.count({
      where: { organizationId, role: 'staff' },
    })
    if (currentStaff >= plan.maxStaff) {
      return errorResponse(
        `Personel limitine ulaştınız (${currentStaff}/${plan.maxStaff}). Planınızı yükseltin.`,
        403
      )
    }
  }

  if (type === 'training' && plan.maxTrainings) {
    const currentTrainings = await prisma.training.count({
      where: { organizationId },
    })
    if (currentTrainings >= plan.maxTrainings) {
      return errorResponse(
        `Eğitim limitine ulaştınız (${currentTrainings}/${plan.maxTrainings}). Planınızı yükseltin.`,
        403
      )
    }
  }

  return null
}
