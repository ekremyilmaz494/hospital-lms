import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/super-admin/messages
 * Web sitesi iletişim formu ve demo talep mesajlarını listeler (arşivlenmemiş).
 * Query: ?source=contact|demo  ·  ?unread=true
 */
export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const unreadOnly = searchParams.get('unread') === 'true'

  const where = {
    isArchived: false,
    ...(source === 'contact' || source === 'demo' ? { source } : {}),
    ...(unreadOnly ? { isRead: false } : {}),
  }

  const [messages, unreadCount, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      select: {
        id: true,
        source: true,
        name: true,
        email: true,
        phone: true,
        organization: true,
        staffCount: true,
        subject: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.contactMessage.count({ where: { isArchived: false, isRead: false } }),
    prisma.contactMessage.count({ where: { isArchived: false } }),
  ])

  return jsonResponse({ messages, unreadCount, total }, 200, {
    'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
  })
})
