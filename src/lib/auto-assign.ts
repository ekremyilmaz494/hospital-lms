import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

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

  // Tüm mevcut atamaları tek sorguda çek (N+1 yerine)
  const trainingIds = activeRules.map((r) => r.trainingId)
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: { userId, trainingId: { in: trainingIds } },
    select: { trainingId: true },
  })
  const existingSet = new Set(existingAssignments.map((a) => a.trainingId))

  // Atanmamış eğitimleri toplu oluştur
  const toAssign = activeRules
    .filter((r) => !existingSet.has(r.trainingId))
    .map((r) => ({
      trainingId: r.trainingId,
      userId,
      status: 'assigned' as const,
      assignedById,
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

    try {
      await prisma.auditLog.create({
        data: {
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
        },
      })
    } catch (err) {
      logger.warn('AutoAssign', 'Audit log olusturulamadi', (err as Error).message)
    }
  }

  return assignedCount
}
