import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createNotificationSchema } from '@/lib/validations'
import type { UserRole } from '@/types/database'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit } = safePagination(searchParams)

  const where = { organizationId }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ])

  return jsonResponse({ notifications, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createNotificationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const notification = await prisma.notification.create({
    data: {
      ...parsed.data,
      organizationId,
    },
  })

  revalidatePath('/staff/notifications')
  revalidatePath('/admin/notifications')

  return jsonResponse(notification, 201)
}, { requireOrganization: true })

// Bulk send to all staff
export const PUT = withAdminRoute(async ({ request, organizationId }) => {
  const body = await parseBody<{ title: string; message: string; type: string }>(request)
  if (!body?.title || !body?.message) return errorResponse('Title and message required')

  // İçerik uzunluk limiti — bulk × 500 kullanıcı → bellek koruması
  if (body.title.length > 200) return errorResponse('Başlık en fazla 200 karakter olabilir', 400)
  if (body.message.length > 5000) return errorResponse('Mesaj en fazla 5000 karakter olabilir', 400)

  const staffUsers = await prisma.user.findMany({
    where: { organizationId, role: 'staff' satisfies UserRole, isActive: true },
    select: { id: true },
  })

  // Rate limit: max 500 kullanıcıya toplu bildirim
  if (staffUsers.length > 500) {
    return errorResponse(`Toplu bildirim en fazla 500 kişiye gönderilebilir. Mevcut personel: ${staffUsers.length}`, 400)
  }

  // Batch gönderim (100'erli gruplarla)
  let totalSent = 0
  for (let i = 0; i < staffUsers.length; i += 100) {
    const batch = staffUsers.slice(i, i + 100)
    const result = await prisma.notification.createMany({
      data: batch.map(u => ({
        userId: u.id,
        organizationId,
        title: body.title,
        message: body.message,
        type: body.type ?? 'announcement',
      })),
    })
    totalSent += result.count
  }

  return jsonResponse({ sent: totalSent })
}, { requireOrganization: true })
