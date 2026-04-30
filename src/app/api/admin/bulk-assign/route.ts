import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'
import { logger } from '@/lib/logger'
import { sendEmail, trainingAssignedEmail } from '@/lib/email'
import type { UserRole } from '@/types/database'

const bulkAssignSchema = z.object({
  trainingIds: z.array(z.string().uuid()).min(1, 'En az 1 eğitim seçilmeli'),
  userIds: z.array(z.string().uuid()).min(1, 'En az 1 personel seçilmeli'),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
})

/**
 * POST /api/admin/bulk-assign
 * Birden fazla eğitimi birden fazla personele tek seferde atar.
 * Zaten atanmış kombinasyonlar sessizce atlanır.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = bulkAssignSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  const { trainingIds, userIds, maxAttempts } = parsed.data

  try {
    // Eğitimler bu organizasyona ait ve aktif mi? Arşivli eğitime yeni atama yapılamaz.
    const trainings = await prisma.training.findMany({
      where: {
        id: { in: trainingIds },
        organizationId: orgId,
        isActive: true,
        publishStatus: { not: 'archived' },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        endDate: true,
        examDurationMinutes: true,
        passingScore: true,
        smgPoints: true,
        isCompulsory: true,
      },
    })
    if (trainings.length !== trainingIds.length) {
      return errorResponse('Bazı eğitimler kurumunuza ait değil veya arşivlenmiş', 403)
    }

    // Kullanıcılar bu organizasyona ait mi?
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
      select: { id: true },
    })
    if (users.length !== userIds.length) {
      return errorResponse('Bazı personeller kurumunuza ait değil veya aktif değil', 403)
    }

    // Mevcut atamaları bul
    const existing = await prisma.trainingAssignment.findMany({
      where: { trainingId: { in: trainingIds }, userId: { in: userIds } },
      select: { trainingId: true, userId: true },
    })
    const existingSet = new Set(existing.map(e => `${e.trainingId}:${e.userId}`))

    // Yeni atama kombinasyonlarını oluştur
    const newAssignments: { trainingId: string; userId: string; maxAttempts: number; originalMaxAttempts: number; assignedById: string }[] = []
    for (const trainingId of trainingIds) {
      for (const userId of userIds) {
        if (!existingSet.has(`${trainingId}:${userId}`)) {
          newAssignments.push({ trainingId, userId, maxAttempts, originalMaxAttempts: maxAttempts, assignedById: dbUser.id })
        }
      }
    }

    if (newAssignments.length === 0) {
      return errorResponse('Seçilen tüm personeller bu eğitimlere zaten atanmış', 409)
    }

    await prisma.$transaction(async (tx) => {
      await tx.trainingAssignment.createMany({ data: newAssignments })

      // Her kullanıcıya, atandığı eğitimler için bildirim oluştur
      const notificationsByUser = new Map<string, string[]>()
      for (const a of newAssignments) {
        const list = notificationsByUser.get(a.userId) ?? []
        list.push(a.trainingId)
        notificationsByUser.set(a.userId, list)
      }

      const notifications: { userId: string; organizationId: string; title: string; message: string; type: string; relatedTrainingId: string }[] = []
      for (const [userId, tIds] of notificationsByUser.entries()) {
        const assignedTrainings = trainings.filter(t => tIds.includes(t.id))
        if (assignedTrainings.length === 1) {
          notifications.push({ userId, organizationId: orgId, title: 'Yeni Eğitim Atandı', message: `"${assignedTrainings[0].title}" eğitimi size atandı.`, type: 'assignment', relatedTrainingId: assignedTrainings[0].id })
        } else {
          notifications.push({ userId, organizationId: orgId, title: `${assignedTrainings.length} Yeni Eğitim Atandı`, message: `${assignedTrainings.map(t => `"${t.title}"`).join(', ')} eğitimleri size atandı.`, type: 'assignment', relatedTrainingId: assignedTrainings[0].id })
        }
      }
      await tx.notification.createMany({ data: notifications })
    })

    await audit({
      action: 'bulk_assign',
      entityType: 'training_assignment',
      newData: { trainingIds, userIds, created: newAssignments.length, skipped: existing.length },
    })

    // Fire-and-forget: atanan her (kullanıcı × eğitim) kombinasyonu için e-posta
    const assignedByName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || null
    void sendBulkAssignmentEmails({
      organizationId: orgId,
      trainings,
      newAssignments,
      maxAttempts,
      assignedByName,
    })

    return jsonResponse({
      created: newAssignments.length,
      skipped: existing.length,
      trainings: trainings.map(t => t.title),
    }, 201)
  } catch (err) {
    logger.error('BulkAssign', 'Toplu atama başarısız', err)
    return errorResponse('Toplu atama yapılamadı', 500)
  }
}, { requireOrganization: true })

type BulkTraining = {
  id: string
  title: string
  description: string | null
  category: string | null
  endDate: Date
  examDurationMinutes: number | null
  passingScore: number | null
  smgPoints: number | null
  isCompulsory: boolean
}

/** Toplu atama sonrası e-postalar — arka planda çalışır, hata yutar. */
async function sendBulkAssignmentEmails(params: {
  organizationId: string
  trainings: BulkTraining[]
  newAssignments: { trainingId: string; userId: string }[]
  maxAttempts: number
  assignedByName: string | null
}) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { name: true },
    })
    if (!org) return

    const userIds = Array.from(new Set(params.newAssignments.map(a => a.userId)))
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: params.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    const usersById = new Map(users.map(u => [u.id, u]))
    const trainingsById = new Map(params.trainings.map(t => [t.id, t]))

    await Promise.allSettled(
      params.newAssignments.map(async (a) => {
        const user = usersById.get(a.userId)
        const training = trainingsById.get(a.trainingId)
        if (!user?.email || !training) return

        const staffName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
        const dueDate = training.endDate.toLocaleDateString('tr-TR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })

        const html = trainingAssignedEmail({
          staffName,
          hospitalName: org.name,
          trainingTitle: training.title,
          trainingDescription: training.description,
          category: training.category,
          endDate: dueDate,
          examDurationMinutes: training.examDurationMinutes,
          maxAttempts: params.maxAttempts,
          passingScore: training.passingScore,
          smgPoints: training.smgPoints,
          isCompulsory: training.isCompulsory,
          assignedByName: params.assignedByName,
        })

        await sendEmail({
          organizationId: params.organizationId,
          to: user.email,
          subject: `${org.name} · Yeni eğitim atandı: ${training.title}`,
          html,
        })
      }),
    )
  } catch (err) {
    logger.error('BulkAssign', 'Toplu atama e-postaları gönderilemedi', err)
  }
}
