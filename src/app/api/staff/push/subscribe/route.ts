import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
} from '@/lib/api-helpers'
import { z } from 'zod/v4'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh:   z.string().min(1),
  auth:     z.string().min(1),
})

/** POST /api/staff/push/subscribe — Web Push aboneliğini kaydet */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz abonelik verisi', 400)
  }

  const { endpoint, p256dh, auth } = parsed.data

  // Varsa güncelle, yoksa oluştur (upsert)
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId: dbUser!.id, endpoint },
    },
    create: {
      userId:   dbUser!.id,
      endpoint,
      p256dh,
      auth,
    },
    update: {
      p256dh,
      auth,
    },
  })

  return jsonResponse({ message: 'Bildirimler aktif edildi' }, 201)
}
