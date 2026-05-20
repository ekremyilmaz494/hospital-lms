import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

// perf-check: no-cache-invalidation — Bildirimler Redis'te cache'lenmiyor;
// admin listesi HTTP Cache-Control (max-age=10) ile kısa süre cache'lenir.

/**
 * Batch alıcı detayı — admin'in bir gönderiminde kimlere bildirim gittiğini,
 * kimin okuduğunu listeler. "Alıcıları gör" modali bu endpoint'i kullanır.
 *
 * Legacy fallback: Eski (batch_id NULL) satırlar için `batchId` parametresi
 * tek bir notification.id olarak da eşleştirilir.
 */
export const GET = withAdminRoute<{ batchId: string }>(
  async ({ params, organizationId, dbUser }) => {
    const { batchId } = params

    const baseWhere = { organizationId, senderId: dbUser.id } as const

    const rows = await prisma.notification.findMany({
      where: {
        ...baseWhere,
        OR: [
          { batchId },
          { id: batchId, batchId: null },
        ],
      },
      select: {
        id: true,
        isRead: true,
        createdAt: true,
        title: true,
        message: true,
        type: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            title: true,
            departmentRel: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ isRead: 'asc' }, { user: { firstName: 'asc' } }],
    })

    if (rows.length === 0) return errorResponse('Bildirim bulunamadı', 404)

    const first = rows[0]
    const readCount = rows.reduce((acc, r) => acc + (r.isRead ? 1 : 0), 0)

    return jsonResponse(
      {
        batchId,
        title: first.title,
        message: first.message,
        type: first.type,
        createdAt: first.createdAt.toISOString(),
        recipientCount: rows.length,
        readCount,
        recipients: rows.map(r => ({
          notificationId: r.id,
          userId: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          email: r.user.email,
          title: r.user.title,
          departmentName: r.user.departmentRel?.name ?? null,
          isRead: r.isRead,
        })),
      },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  },
  { requireOrganization: true },
)

/**
 * Batch silme — bir gönderimin tüm alıcı satırlarını siler. Sadece kendi
 * gönderdiği batch'leri silebilir (senderId guard). Legacy fallback: NULL
 * batch_id'li tekil satır da `id = batchId` ile silinir.
 */
export const DELETE = withAdminRoute<{ batchId: string }>(
  async ({ params, organizationId, dbUser }) => {
    const { batchId } = params

    try {
      const result = await prisma.notification.deleteMany({
        where: {
          organizationId,
          senderId: dbUser.id,
          OR: [
            { batchId },
            { id: batchId, batchId: null },
          ],
        },
      })
      if (result.count === 0) return errorResponse('Bildirim bulunamadı', 404)
      return jsonResponse({ success: true, deleted: result.count })
    } catch (err) {
      logger.error('Admin Notifications Batch', 'Bildirim silinemedi', err)
      return errorResponse('Bildirim silinemedi', 500)
    }
  },
  { requireOrganization: true },
)
