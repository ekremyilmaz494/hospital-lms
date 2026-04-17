import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'

    // Sistem tarafından otomatik oluşturulan bildirimler hariç tutulur;
    // sadece admin panelinden gönderilen bildirimler gösterilir.
    const SYSTEM_TYPES = ['exam_passed', 'exam_failed', 'exam_started', 'training_assigned']

    const where: Record<string, unknown> = {
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      type: { notIn: SYSTEM_TYPES },
    }
    if (unreadOnly) where.isRead = false

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          createdAt: true,
          relatedTrainingId: true,
          relatedTraining: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: dbUser!.id, organizationId: dbUser!.organizationId, isRead: false },
      }),
    ])

    return jsonResponse({ notifications, unreadCount }, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
  } catch (err) {
    logger.error('Staff Notifications', 'Bildirimler yüklenemedi', err)
    return errorResponse('Bildirimler yüklenemedi', 503)
  }
}

// Mark notifications as read
export async function PATCH(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) return errorResponse('Geçersiz bildirim ID', 400)
    const result = await prisma.notification.updateMany({
      where: { id, userId: dbUser!.id, organizationId: dbUser!.organizationId },
      data: { isRead: true },
    })
    if (result.count === 0) return jsonResponse({ error: 'Bildirim bulunamadı' }, 404)
  } else {
    // Snapshot-based mark-all: önce okunmamış ID'leri al, sonra sadece onları güncelle.
    // updateMany atomik olsa da, bu yaklaşım eşzamanlı yeni bildirimlerin
    // yanlışlıkla "okundu" olarak işaretlenmesini kesin olarak önler.
    const unreadIds = await prisma.notification.findMany({
      where: { userId: dbUser!.id, organizationId: dbUser!.organizationId, isRead: false },
      select: { id: true },
    })
    if (unreadIds.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: unreadIds.map(n => n.id) } },
        data: { isRead: true },
      })
    }
  }

  return jsonResponse({ success: true })
}
