import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createAuditLog } from '@/lib/api-helpers'
import { getOrCreateActivePeriodForAssignment } from '@/lib/training-periods'

/**
 * Departman eğitim kurallarına göre otomatik atama yapar.
 * Kullanıcı bir departmana eklendiğinde veya yeni personel oluşturulduğunda çağrılır.
 */
export async function autoAssignByDepartment(
  userId: string,
  departmentId: string,
  organizationId: string,
  assignedById?: string
): Promise<number> {
  // Cross-tenant koruma: userId verilen organizasyona bağlı OLMALI — bağlılık PRIMARY
  // (User.organizationId) VEYA aktif ÜYELİK (OrganizationMembership) ile olur (çok-hastaneli grup:
  // ortak doktor tek hesapla EK hastanede de staff'tır). Çağrı yapan helper'lar bazen userId'yi
  // sorgulamadan iletiyor — bu son kapı. Aşağıdaki rules/atama HER İKİSİNDE de `organizationId`
  // ile scope'lu → gerçek cross-tenant (ne primary ne üye) HÂLÂ bloklanır; tekil-org'da üyelik
  // dalı 0 satır (inert). Bu değişiklik yalnız ORTAK personel yolunu açar, izolasyonu gevşetmez.
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      OR: [
        { organizationId },
        { memberships: { some: { organizationId, isActive: true } } },
      ],
    },
    select: { id: true },
  })
  if (!user) {
    logger.warn('AutoAssign', `Cross-tenant attempt blocked: user=${userId} org=${organizationId}`)
    return 0
  }

  const rules = await prisma.departmentTrainingRule.findMany({
    where: { departmentId, organizationId, isActive: true },
    include: { training: { select: { id: true, isActive: true, endDate: true } } },
  })

  if (rules.length === 0) return 0

  // Aktif ve süresi dolmamış eğitimleri filtrele
  const now = new Date()
  const activeRules = rules.filter(
    (r) => r.training.isActive && !(r.training.endDate && new Date(r.training.endDate) < now)
  )
  if (activeRules.length === 0) return 0

  // Aktif period — atama bu döneme bağlanır. Yoksa otomatik açılır.
  // Hata durumunda atama yine yapılır ama periodId null kalır (best-effort).
  // Existing check'ten ÖNCE çözümlenir: existing filter periodId boyutunu da
  // kullansın — kullanıcı geçen dönemde aynı eğitimi aldıysa yeni dönemde
  // tekrar atama düşmeli (composite unique zaten izin veriyor).
  let periodId: string | null = null
  try {
    const period = await getOrCreateActivePeriodForAssignment(organizationId)
    if (period.status !== 'closed') periodId = period.id
  } catch (err) {
    logger.warn('AutoAssign', 'Period resolve basarisiz, periodId null', err instanceof Error ? err.message : err)
  }

  // Tüm mevcut atamaları tek sorguda çek (N+1 yerine) — periodId boyutuyla.
  // periodId=null kayıtları yalnızca periodId=null context'inde yakalanır.
  const trainingIds = activeRules.map((r) => r.trainingId)
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: {
      userId,
      trainingId: { in: trainingIds },
      periodId: periodId ?? null,
    },
    select: { trainingId: true },
  })
  const existingSet = new Set(existingAssignments.map((a) => a.trainingId))

  // Atanmamış eğitimleri toplu oluştur
  const toAssign = activeRules
    .filter((r) => !existingSet.has(r.trainingId))
    .map((r) => ({
      trainingId: r.trainingId,
      userId,
      organizationId,
      status: 'assigned' as const,
      assignedById,
      ...(periodId && { periodId }),
    }))

  let assignedCount = 0
  if (toAssign.length > 0) {
    try {
      const result = await prisma.trainingAssignment.createMany({
        data: toAssign,
        skipDuplicates: true,
      })
      assignedCount = result.count
    } catch (err) {
      logger.warn('AutoAssign', `Toplu otomatik atama basarisiz: user=${userId}`, (err as Error).message)
    }
  }

  if (assignedCount > 0) {
    logger.info('AutoAssign', `${assignedCount} egitim otomatik atandi`, { userId, departmentId })

    // Hash zincirine dahil olsun diye doğrudan create yerine createAuditLog
    // (kendi hatasını yutar — ana akışı durdurmaz).
    await createAuditLog({
      action: 'auto_assign',
      entityType: 'training_assignment',
      entityId: departmentId,
      organizationId,
      userId: assignedById ?? userId,
      newData: {
        assignedCount,
        targetUserId: userId,
        departmentId,
        message: `${assignedCount} eğitim departman kuralına göre otomatik atandı`,
      },
    })
  }

  return assignedCount
}
