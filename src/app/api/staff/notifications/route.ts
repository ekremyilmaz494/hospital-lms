import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const where: Record<string, unknown> = { userId: dbUser!.id }
  if (unreadOnly) where.isRead = false

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({ where: { userId: dbUser!.id, isRead: false } })

  return jsonResponse({ notifications, unreadCount })
}

// Mark notifications as read
export async function PATCH(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    await prisma.notification.update({ where: { id, userId: dbUser!.id }, data: { isRead: true } })
  } else {
    await prisma.notification.updateMany({ where: { userId: dbUser!.id, isRead: false }, data: { isRead: true } })
  }

  return jsonResponse({ success: true })
}
