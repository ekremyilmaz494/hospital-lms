import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { sendEmail, escapeHtml } from '@/lib/email'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

const sendNotificationSchema = z.object({
  title: z.string().min(1, 'Başlık zorunludur').max(500),
  message: z.string().min(1, 'Mesaj zorunludur').max(5000),
  type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
  recipientIds: z.array(z.string().uuid()).min(1, 'En az bir alıcı seçmelisiniz').max(500),
  sendEmail: z.boolean().default(false),
})

/** Bildirim e-posta template'i */
function notificationEmailHtml(title: string, message: string, type: string, appUrl: string): string {
  const typeColors: Record<string, string> = {
    info: '#2563eb',
    warning: '#d97706',
    error: '#dc2626',
    success: '#059669',
  }
  const color = typeColors[type] ?? '#2563eb'

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #065f46); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Devakent Hastanesi</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Yeni Bildirim</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 18px;">${escapeHtml(title)}</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
        </div>
        <a href="${escapeHtml(appUrl)}/staff/notifications"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
          Bildirimleri Görüntüle
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Bu e-posta Devakent Hastanesi sistemi tarafından otomatik olarak gönderilmiştir.</p>
      </div>
    </div>
  `
}

/**
 * POST /api/admin/notifications/send
 * Toplu bildirim + opsiyonel e-posta gönderimi.
 * Frontend'den tek request ile çoklu alıcıya bildirim oluşturur.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  // User bazlı rate limit: 100 bildirim / 1 saat
  const allowed = await checkRateLimit(`notif-send:${dbUser.id}`, 100, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla bildirim gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi', 400)

  const parsed = sendNotificationSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { title, message, type, recipientIds, sendEmail: shouldSendEmail } = parsed.data

  // Alıcıların bu org'a ait olduğunu doğrula
  const validUsers = await prisma.user.findMany({
    where: {
      id: { in: recipientIds },
      organizationId,
      isActive: true,
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  if (validUsers.length === 0) {
    return errorResponse('Geçerli alıcı bulunamadı', 400)
  }

  // Bildirimleri toplu oluştur
  const notifResult = await prisma.notification.createMany({
    data: validUsers.map(u => ({
      userId: u.id,
      organizationId,
      title,
      message,
      type,
    })),
  })

  // Opsiyonel e-posta gönderimi (arka planda, batch halinde)
  let emailsSent = 0
  let emailsFailed = 0

  if (shouldSendEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const html = notificationEmailHtml(title, message, type, appUrl)

    // 20'li batch'ler halinde gönder (SMTP rate limit'e takılmamak için)
    const BATCH_SIZE = 20
    for (let i = 0; i < validUsers.length; i += BATCH_SIZE) {
      const batch = validUsers.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(u =>
          sendEmail({
            to: u.email,
            subject: `[Devakent Hastanesi] ${title}`,
            html,
          })
        )
      )
      for (const r of results) {
        if (r.status === 'fulfilled') emailsSent++
        else {
          emailsFailed++
          logger.warn('NotifSend', 'E-posta gonderilemedi', r.reason instanceof Error ? r.reason.message : r.reason)
        }
      }
    }
  }

  // Audit log
  await audit({
    action: 'notification.bulk_send',
    entityType: 'notification',
    newData: {
      title,
      type,
      recipientCount: validUsers.length,
      emailsSent,
      emailsFailed,
      sendEmail: shouldSendEmail,
    },
  })

  logger.info('NotifSend', 'Toplu bildirim gonderildi', {
    orgId: organizationId,
    recipientCount: validUsers.length,
    notificationsCreated: notifResult.count,
    emailsSent,
    emailsFailed,
  })

  return jsonResponse({
    success: true,
    notificationsCreated: notifResult.count,
    emailsSent,
    emailsFailed,
    recipientCount: validUsers.length,
  }, 201)
}, { requireOrganization: true })
