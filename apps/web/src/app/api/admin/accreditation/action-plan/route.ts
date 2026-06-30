import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'
import type { UserRole } from '@/types/database'
import { findActivePeriod } from '@/lib/training-periods'
import { VALID_STANDARD_BODIES } from '@/lib/accreditation'

const VALID_CATEGORIES = [
  'enfeksiyon', 'is-guvenligi', 'hasta-haklari', 'radyoloji',
  'laboratuvar', 'eczane', 'acil', 'genel',
] as const

const actionPlanSchema = z.object({
  standardBody: z.enum(VALID_STANDARD_BODIES),
  /** Eksik personeli atamak icin kullanilacak egitim kategorileri */
  categories: z.array(z.enum(VALID_CATEGORIES)).min(1),
  /** Hedef tamamlanma tarihi */
  dueDate: z.string().datetime().optional(),
})

/**
 * POST /api/admin/accreditation/action-plan
 *
 * Belirlenen kategorilerdeki yayindaki aktif egitimleri, o egitimlerde atamasi
 * olmayan aktif personele atar (TrainingAssignment).
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Gecersiz istek verisi')

  const parsed = actionPlanSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Gecersiz veri')

  const { standardBody, categories, dueDate } = parsed.data
  const orgId = organizationId

  try {
    const [trainings, allStaff, activePeriod] = await Promise.all([
      prisma.training.findMany({
        where: {
          organizationId: orgId,
          isActive: true,
          publishStatus: 'published',
          category: { in: categories },
        },
        select: { id: true, category: true },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
        select: { id: true },
      }),
      findActivePeriod(orgId),
    ])

    if (trainings.length === 0) {
      return errorResponse('Bu kategorilerde yayinda aktif egitim bulunamadi')
    }

    if (allStaff.length === 0) {
      return jsonResponse({ message: 'Atanacak aktif personel bulunamadi.', createdCount: 0 })
    }

    const existingAssignments = await prisma.trainingAssignment.findMany({
      where: {
        trainingId: { in: trainings.map(t => t.id) },
        userId: { in: allStaff.map(s => s.id) },
        ...(activePeriod ? { periodId: activePeriod.id } : {}),
      },
      select: { userId: true, trainingId: true },
    })

    const existingSet = new Set(
      existingAssignments.map(a => `${a.userId}:${a.trainingId}`)
    )

    const newAssignments: {
      userId: string
      trainingId: string
      organizationId: string
      assignedById: string
      dueDate?: Date
    }[] = []

    for (const staff of allStaff) {
      for (const training of trainings) {
        if (!existingSet.has(`${staff.id}:${training.id}`)) {
          newAssignments.push({
            userId: staff.id,
            trainingId: training.id,
            organizationId: orgId,
            assignedById: dbUser.id,
            ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
          })
        }
      }
    }

    if (newAssignments.length === 0) {
      return jsonResponse({ message: 'Tum personel zaten bu egitimlere atanmis.', createdCount: 0 })
    }

    const result = await prisma.trainingAssignment.createMany({
      data: newAssignments.map(a => ({
        ...a,
        ...(activePeriod && { periodId: activePeriod.id }),
        status: 'assigned',
        assignedAt: new Date(),
      })),
      skipDuplicates: true,
    })

    await audit({
      action: 'accreditation_action_plan_created',
      entityType: 'training_assignment',
      newData: {
        standardBody,
        categories,
        createdCount: result.count,
        trainingsCount: trainings.length,
        staffCount: allStaff.length,
      },
    })

    return jsonResponse(
      { message: `${result.count} yeni atama olusturuldu.`, createdCount: result.count },
      201
    )
  } catch {
    return errorResponse('Aksiyon plani olusturulamadi', 500)
  }
}, { requireOrganization: true })
