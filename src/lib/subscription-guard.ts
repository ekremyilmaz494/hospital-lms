import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'

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
    return errorResponse('Aboneliginiz aktif degil. Lutfen aboneliginizi yenileyiniz.', 403)
  }

  // Trial süresi dolmuş mu?
  if (subscription.status === 'trial' && subscription.trialEndsAt && new Date(subscription.trialEndsAt) < new Date()) {
    return errorResponse('Deneme suresiniz dolmustur. Lutfen bir plan satin aliniz.', 403)
  }

  const plan = subscription.plan

  if (type === 'staff' && plan.maxStaff) {
    const currentStaff = await prisma.user.count({
      where: { organizationId, role: 'staff' },
    })
    if (currentStaff >= plan.maxStaff) {
      return errorResponse(
        `Personel limitine ulastiniz (${currentStaff}/${plan.maxStaff}). Planınizi yukseltin.`,
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
        `Egitim limitine ulastiniz (${currentTrainings}/${plan.maxTrainings}). Planinizi yukseltin.`,
        403
      )
    }
  }

  return null
}
