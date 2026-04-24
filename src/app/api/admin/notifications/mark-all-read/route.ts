import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function POST() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const result = await prisma.notification.updateMany({
      where: {
        organizationId: dbUser!.organizationId!,
        isRead: false,
      },
      data: { isRead: true },
    })

    return jsonResponse({ updated: result.count })
  } catch (err) {
    logger.error('Admin Notifications', 'Toplu okundu işaretleme başarısız', err)
    return errorResponse('Bildirimler güncellenemedi', 500)
  }
}
