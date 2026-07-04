import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'

// perf-check: no-cache-invalidation — contact_messages org-cache'lenmez; liste
// GET'i client'ta no-store, sunucuda kısa max-age ile servis edilir.

/**
 * PATCH /api/super-admin/messages/[id]
 * Mesajı okundu işaretle veya arşivle.
 * Body: { isRead?: boolean, isArchived?: boolean }
 */
export const PATCH = withSuperAdminRoute<{ id: string }>(async ({ request, params, dbUser, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`sa-message-patch:${dbUser.id}`, 60, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen biraz bekleyin.', 429)

  const body = await parseBody<{ isRead?: boolean; isArchived?: boolean }>(request)
  if (!body) return errorResponse('Geçersiz veri', 400)

  const existing = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) return errorResponse('Mesaj bulunamadı', 404)

  const data: { isRead?: boolean; readAt?: Date | null; isArchived?: boolean } = {}
  if (typeof body.isRead === 'boolean') {
    data.isRead = body.isRead
    data.readAt = body.isRead ? new Date() : null
  }
  if (typeof body.isArchived === 'boolean') {
    data.isArchived = body.isArchived
  }

  if (Object.keys(data).length === 0) {
    return errorResponse('Güncellenecek alan yok', 400)
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data,
    select: { id: true, isRead: true, isArchived: true },
  })

  await audit({
    action: 'contact_message.update',
    entityType: 'contact_message',
    entityId: id,
    newData: data,
  })

  return jsonResponse(updated)
})

/**
 * DELETE /api/super-admin/messages/[id]
 * Mesajı kalıcı olarak siler.
 */
export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, dbUser, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`sa-message-delete:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen biraz bekleyin.', 429)

  const existing = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) return errorResponse('Mesaj bulunamadı', 404)

  await prisma.contactMessage.delete({ where: { id } })

  await audit({
    action: 'contact_message.delete',
    entityType: 'contact_message',
    entityId: id,
  })

  return jsonResponse({ success: true })
})
