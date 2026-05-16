import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/** POST /api/staff/push/unsubscribe — Web Push aboneliğini sil */
export const POST = withStaffRoute(async ({ request, dbUser }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz istek verisi', 400)
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      userId:   dbUser.id,
      endpoint: parsed.data.endpoint,
    },
  })

  return jsonResponse({ message: 'Bildirimler devre dışı bırakıldı' })
})
