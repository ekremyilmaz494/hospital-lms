import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, dbUser }) => {
  const { id } = params

  try {
    // senderId guard — yalnız bildirimi gönderen admin silebilir (batch route ile aynı
    // güvenlik modeli). Başka adminin gönderdiği bildirimi silmeyi engeller.
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId, senderId: dbUser.id },
    })
    if (!notification) return errorResponse('Bildirim bulunamadı', 404)

    await prisma.notification.delete({ where: { id } })
    return jsonResponse({ success: true })
  } catch (err) {
    logger.error('Admin Notifications', 'Bildirim silinemedi', err)
    return errorResponse('Bildirim silinemedi', 500)
  }
}, { requireOrganization: true })
