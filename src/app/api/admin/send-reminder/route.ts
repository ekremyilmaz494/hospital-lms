import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
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
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = reminderSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  try {
    // Hedef atamaları bul
    let assignments
    if (parsed.data.trainingId) {
      const training = await prisma.training.findFirst({ where: { id: parsed.data.trainingId, organizationId: orgId } })
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
          training: { organizationId: orgId },
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

    for (const a of assignments) {
      const daysOverdue = a.training.endDate
        ? Math.floor((Date.now() - new Date(a.training.endDate).getTime()) / 86400000)
        : 0

      // Email gönder
      try {
        await sendEmail({
          to: a.user.email,
          subject: `Hatırlatma: "${a.training.title}" eğitimini tamamlayın`,
          html: overdueTrainingReminderEmail(
            `${a.user.firstName} ${a.user.lastName}`,
            a.training.title,
            a.training.endDate ? new Date(a.training.endDate).toLocaleDateString('tr-TR') : '',
            daysOverdue,
          ),
        })
        emailsSent++
      } catch (emailErr) {
        errors.push(`${a.user.email}: email gönderilemedi`)
        logger.error('SendReminder', `Email gönderilemedi: ${a.user.email}`, emailErr)
      }

      // Uygulama bildirimi oluştur
      try {
        await prisma.notification.create({
          data: {
            userId: a.user.id,
            organizationId: orgId,
            title: 'Eğitim Hatırlatması',
            message: parsed.data.customMessage
              ? parsed.data.customMessage
              : `"${a.training.title}" eğitiminiz gecikmiştir. Lütfen en kısa sürede tamamlayın.`,
            type: 'reminder',
            relatedTrainingId: a.trainingId,
          },
        })
        notificationsSent++
      } catch {
        errors.push(`${a.user.email}: bildirim oluşturulamadı`)
      }
    }

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'send_reminder',
      entityType: 'training_assignment',
      newData: { targetCount: assignments.length, emailsSent, notificationsSent, errors: errors.length },
      request,
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
}
