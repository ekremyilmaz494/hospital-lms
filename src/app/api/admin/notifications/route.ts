import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { createNotificationSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit } = safePagination(searchParams)

  const where = { organizationId: dbUser!.organizationId! }

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

  return jsonResponse({ notifications, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createNotificationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const notification = await prisma.notification.create({
    data: {
      ...parsed.data,
      organizationId: dbUser!.organizationId!,
    },
  })

  revalidatePath('/staff/notifications')
  revalidatePath('/admin/notifications')

  return jsonResponse(notification, 201)
}

// Bulk send to all staff
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<{ title: string; message: string; type: string }>(request)
  if (!body?.title || !body?.message) return errorResponse('Title and message required')

  // İçerik uzunluk limiti — bulk × 500 kullanıcı → bellek koruması
  if (body.title.length > 200) return errorResponse('Başlık en fazla 200 karakter olabilir', 400)
  if (body.message.length > 5000) return errorResponse('Mesaj en fazla 5000 karakter olabilir', 400)

  const staffUsers = await prisma.user.findMany({
    where: { organizationId: dbUser!.organizationId!, role: 'staff', isActive: true },
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
        organizationId: dbUser!.organizationId!,
        title: body.title,
        message: body.message,
        type: body.type ?? 'announcement',
      })),
    })
    totalSent += result.count
  }

  return jsonResponse({ sent: totalSent })
}
