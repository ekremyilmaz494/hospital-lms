import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'

const unregisterSchema = z.object({
  token: z.string().regex(/^ExponentPushToken\[.+\]$/, 'Geçersiz Expo push token'),
})

/**
 * POST /api/staff/push/expo/unregister
 *
 * Logout / uninstall'da çağrılır. Token başka bir kullanıcıya ait ise (token
 * çalınmış / cihaz devredilmiş senaryosu) yine sadece bu kullanıcının
 * kaydını siler — userId kontrolü ile.
 */
export const POST = withStaffRoute(async ({ request, dbUser }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = unregisterSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz token verisi', 400)
  }

  await prisma.expoPushToken.deleteMany({
    where: {
      token: parsed.data.token,
      userId: dbUser.id,
    },
  })

  return jsonResponse({ message: 'Bildirim tokenı silindi' })
})
