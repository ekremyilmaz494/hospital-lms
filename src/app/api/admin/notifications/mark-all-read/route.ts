import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

export const POST = withAdminRoute(async ({ organizationId }) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        organizationId,
        isRead: false,
      },
      data: { isRead: true },
    })

    return jsonResponse({ updated: result.count })
  } catch (err) {
    logger.error('Admin Notifications', 'Toplu okundu işaretleme başarısız', err)
    return errorResponse('Bildirimler güncellenemedi', 500)
  }
}, { requireOrganization: true })
