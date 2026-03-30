import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
} from '@/lib/api-helpers'
import { z } from 'zod/v4'

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/** POST /api/staff/push/unsubscribe — Web Push aboneliğini sil */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz istek verisi', 400)
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      userId:   dbUser!.id,
      endpoint: parsed.data.endpoint,
    },
  })

  return jsonResponse({ message: 'Bildirimler devre dışı bırakıldı' })
}
