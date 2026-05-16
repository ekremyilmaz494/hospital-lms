import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { sendEmail, overdueTrainingReminderEmail } from '@/lib/email'
import { z } from 'zod/v4'
import { logger } from '@/lib/logger'

const reminderSchema = z.object({
  // Belirli assignment'lar için (overdue listesinden)
  assignmentIds: z.array(z.string().uuid()).optional(),
  // Eğitim ID'si ile tüm gecikenlere
  trainingId: z.string().uuid().optional(),
  // Özel mesaj (opsiyonel)
  customMessage: z.string().max(500).optional(),
}).refine(d => d.assignmentIds?.length || d.trainingId, { message: 'assignmentIds veya trainingId zorunlu' })

/**
 * POST /api/admin/send-reminder
 * Gecikmiş personele manuel email + uygulama bildirimi gönderir.
 */
export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = reminderSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  try {
    // Hedef atamaları bul
    let assignments
    if (parsed.data.trainingId) {
      const training = await prisma.training.findFirst({ where: { id: parsed.data.trainingId, organizationId } })
      if (!training) return errorResponse('Eğitim bulunamadı', 404)

      assignments = await prisma.trainingAssignment.findMany({
        where: {
          trainingId: parsed.data.trainingId,
          status: { in: ['assigned', 'in_progress', 'failed'] },
          training: { endDate: { lt: new Date() } },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          training: { select: { title: true, endDate: true } },
        },
        take: 100,
      })
    } else {
      assignments = await prisma.trainingAssignment.findMany({
        where: {
          id: { in: parsed.data.assignmentIds! },
          training: { organizationId },
          status: { in: ['assigned', 'in_progress', 'failed'] },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          training: { select: { title: true, endDate: true } },
        },
      })
    }

    if (assignments.length === 0) {
      return errorResponse('Hatırlatma gönderilecek gecikmiş atama bulunamadı')
    }

    let emailsSent = 0
    let notificationsSent = 0
    const errors: string[] = []

    // Bildirimleri toplu oluştur (N sorgu → 1 sorgu)
    try {
      const result = await prisma.notification.createMany({
        data: assignments.map(a => ({
          userId: a.user.id,
          organizationId,
          title: 'Eğitim Hatırlatması',
          message: parsed.data.customMessage
            ? parsed.data.customMessage
            : `"${a.training.title}" eğitiminiz gecikmiştir. Lütfen en kısa sürede tamamlayın.`,
          type: 'reminder',
          relatedTrainingId: a.trainingId,
        })),
        skipDuplicates: true,
      })
      notificationsSent = result.count
    } catch {
      errors.push('Toplu bildirim oluşturulamadı')
    }

    // Emailleri 20'li partiler halinde paralel gönder
    const EMAIL_BATCH = 20
    for (let i = 0; i < assignments.length; i += EMAIL_BATCH) {
      const batch = assignments.slice(i, i + EMAIL_BATCH)
      const results = await Promise.allSettled(batch.map(a => {
        const daysOverdue = a.training.endDate
          ? Math.floor((Date.now() - new Date(a.training.endDate).getTime()) / 86400000)
          : 0
        return sendEmail({
          to: a.user.email,
          subject: `Hatırlatma: "${a.training.title}" eğitimini tamamlayın`,
          html: overdueTrainingReminderEmail(
            `${a.user.firstName} ${a.user.lastName}`,
            a.training.title,
            a.training.endDate ? new Date(a.training.endDate).toLocaleDateString('tr-TR') : '',
            daysOverdue,
          ),
        })
      }))
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          emailsSent++
        } else {
          const email = batch[j].user.email
          errors.push(`${email}: email gönderilemedi`)
          logger.error('SendReminder', `Email gönderilemedi: ${email}`, (results[j] as PromiseRejectedResult).reason)
        }
      }
    }

    await audit({
      action: 'send_reminder',
      entityType: 'training_assignment',
      newData: { targetCount: assignments.length, emailsSent, notificationsSent, errors: errors.length },
    })

    return jsonResponse({
      targetCount: assignments.length,
      emailsSent,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    logger.error('SendReminder', 'Hatırlatma gönderilemedi', err)
    return errorResponse('Hatırlatma gönderilemedi', 500)
  }
}, { requireOrganization: true })
