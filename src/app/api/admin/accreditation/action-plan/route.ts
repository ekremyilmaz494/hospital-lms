import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { z } from 'zod/v4'

const actionPlanSchema = z.object({
  standardBody: z.enum(['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA']),
  /** Eksik personeli atamak için kullanılacak eğitim kategorileri */
  categories: z.array(z.string().min(1)).min(1),
  /** Hedef tamamlanma tarihi */
  dueDate: z.string().datetime().optional(),
})

/**
 * POST /api/admin/accreditation/action-plan
 *
 * Belirlenen kategorilerdeki aktif eğitimleri, o kategorilerde hiç
 * assignment'ı olmayan tüm personele atar (TrainingAssignment).
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = actionPlanSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri')

  const { categories, dueDate } = parsed.data
  const orgId = dbUser!.organizationId!

  try {
    // Paralel: ilgili eğitimler + tüm aktif personel
    const [trainings, allStaff] = await Promise.all([
      prisma.training.findMany({
        where: {
          organizationId: orgId,
          isActive: true,
          category: { in: categories },
        },
        select: { id: true, category: true },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff', isActive: true },
        select: { id: true },
      }),
    ])

    if (trainings.length === 0) {
      return errorResponse('Bu kategorilerde aktif eğitim bulunamadı')
    }

    // Mevcut assignment'ları bir Set olarak al (userId-trainingId ikilisi)
    const existingAssignments = await prisma.trainingAssignment.findMany({
      where: {
        trainingId: { in: trainings.map(t => t.id) },
        userId: { in: allStaff.map(s => s.id) },
      },
      select: { userId: true, trainingId: true },
    })

    const existingSet = new Set(
      existingAssignments.map(a => `${a.userId}:${a.trainingId}`)
    )

    // Eksik assignment'ları belirle
    const newAssignments: { userId: string; trainingId: string; assignedBy: string; dueDate?: Date }[] = []
    for (const staff of allStaff) {
      for (const training of trainings) {
        if (!existingSet.has(`${staff.id}:${training.id}`)) {
          newAssignments.push({
            userId: staff.id,
            trainingId: training.id,
            assignedBy: dbUser!.id,
            ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
          })
        }
      }
    }

    if (newAssignments.length === 0) {
      return jsonResponse({ message: 'Tüm personel zaten bu eğitimlere atanmış.', createdCount: 0 })
    }

    // Toplu oluştur
    const result = await prisma.trainingAssignment.createMany({
      data: newAssignments.map(a => ({
        ...a,
        status: 'assigned',
        assignedAt: new Date(),
      })),
      skipDuplicates: true,
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'accreditation_action_plan_created',
      entityType: 'training_assignment',
      newData: {
        categories,
        createdCount: result.count,
        trainingsCount: trainings.length,
        staffCount: allStaff.length,
      },
    })

    return jsonResponse(
      { message: `${result.count} yeni atama oluşturuldu.`, createdCount: result.count },
      201
    )
  } catch {
    return errorResponse('Aksiyon planı oluşturulamadı', 500)
  }
}
