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

  let assignedCount = 0

  for (const rule of rules) {
    // Sadece aktif ve süresi dolmamış eğitimler
    if (!rule.training.isActive) continue
    if (rule.training.endDate && new Date(rule.training.endDate) < new Date()) continue

    // Zaten atanmış mı?
    const existing = await prisma.trainingAssignment.findUnique({
      where: { trainingId_userId: { trainingId: rule.trainingId, userId } },
    })
    if (existing) continue

    try {
      await prisma.trainingAssignment.create({
        data: {
          trainingId: rule.trainingId,
          userId,
          status: 'assigned',
          assignedById,
        },
      })
      assignedCount++
    } catch (err) {
      logger.warn('AutoAssign', `Otomatik atama basarisiz: user=${userId} training=${rule.trainingId}`, (err as Error).message)
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
