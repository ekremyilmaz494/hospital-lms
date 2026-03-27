import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId: dbUser!.organizationId! },
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
}
