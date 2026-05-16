import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

export const POST = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId },
    })

    if (!notification) return errorResponse('Bildirim bulunamadı', 404)

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return jsonResponse({ success: true })
  } catch (err) {
    logger.error('Admin Notifications', 'Bildirim okundu işaretleme başarısız', err)
    return errorResponse('Bildirim güncellenemedi', 500)
  }
}, { requireOrganization: true })
