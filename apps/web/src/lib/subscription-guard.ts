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

  if (type === 'staff') {
    // Tek kaynak: org override (super-admin) → plan → sınırsız + bekleyen davet sayımı.
    return checkStaffLimit(organizationId, 1)
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

// ── PERSONEL (SEAT) LİMİTİ ──────────────────────────────────────────────────
// Org-bazında sözleşmeli personel sınırı. Super-admin `Organization.maxStaff` ile
// istediği zaman değiştirir (ör. Devakent = 150). Limit aşılınca yeni personel/davet
// 403 ile reddedilir → müşteriden yeni ücret talep edilir.

/**
 * Bir organizasyona atanabilecek personel (seat) sayısının ETKİN limiti.
 * Öncelik sırası:
 *   1. `Organization.maxStaff` — super-admin override (bu org'a özel sözleşme)
 *   2. `SubscriptionPlan.maxStaff` — plan limiti
 *   3. `null` — sınırsız (ikisi de tanımsızsa)
 *
 * @returns Etkin limit veya sınırsızsa `null`.
 */
export async function resolveStaffLimit(organizationId: string): Promise<number | null> {
  const [org, subscription] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { maxStaff: true },
    }),
    prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { plan: { select: { maxStaff: true } } },
    }),
  ])

  if (org?.maxStaff != null) return org.maxStaff
  return subscription?.plan?.maxStaff ?? null
}

/**
 * Bir org'un ŞU AN dolu tuttuğu personel koltuğu sayısı:
 *   aktif personel kullanıcıları + bekleyen personel davetleri
 * (kabul edilmemiş + iptal edilmemiş + süresi geçmemiş).
 *
 * Davetleri de saymak kritik: aksi halde limit dolusuna kadar davet gönderilip,
 * hepsi kabul edildiğinde sözleşme sınırı sessizce aşılır. Pasif (deaktif) personel
 * koltuk tüketmez — deaktivasyon koltuğu boşaltır.
 */
export async function countStaffSeats(organizationId: string): Promise<number> {
  const now = new Date()
  const [staff, pendingInvites] = await Promise.all([
    prisma.user.count({ where: { organizationId, role: 'staff', isActive: true } }),
    prisma.invitation.count({
      where: { organizationId, role: 'staff', acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    }),
  ])
  return staff + pendingInvites
}

/**
 * Personel oluşturma/davet AKIŞLARININ ÖNÜNDE çağrılan seat-limit guard'ı.
 *
 * @param organizationId Hedef organizasyon.
 * @param adding Eklenmek istenen kişi sayısı (tekli create/davet = 1, toplu içe
 *   aktarımda geçerli satır sayısı).
 * @returns Limit aşılacaksa 403 `Response` (Türkçe, kalan koltuk bilgisiyle); yoksa `null`.
 */
export async function checkStaffLimit(
  organizationId: string,
  adding = 1
): Promise<Response | null> {
  const limit = await resolveStaffLimit(organizationId)
  if (limit == null) return null // sınırsız

  const used = await countStaffSeats(organizationId)
  if (used + adding <= limit) return null

  const remaining = Math.max(0, limit - used)
  const message =
    adding <= 1
      ? `Personel limitine ulaşıldı (${used}/${limit}). Yeni personel eklemek için lütfen Klinovax ile iletişime geçin.`
      : `Personel limiti aşılıyor: ${used}/${limit} koltuk dolu (${remaining} boş), ancak ${adding} kişi eklenmek isteniyor. Lütfen Klinovax ile iletişime geçin.`

  // Yapısal 403 — frontend `code` ile güvenilir şekilde limit-uyarı modalı gösterir
  // (metin eşleştirmesi kırılgan). limit/used/remaining alanları modalda sayı göstermek için.
  return new Response(
    JSON.stringify({ error: message, code: 'STAFF_LIMIT_REACHED', limit, used, remaining, requested: adding }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  )
}
