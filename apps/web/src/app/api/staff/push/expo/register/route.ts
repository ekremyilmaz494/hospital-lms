import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'

const registerSchema = z.object({
  // Expo push token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  token:      z.string().regex(/^ExponentPushToken\[.+\]$/, 'Geçersiz Expo push token'),
  platform:   z.enum(['ios', 'android']),
  deviceName: z.string().max(100).optional(),
})

/**
 * POST /api/staff/push/expo/register
 *
 * Mobile app (Expo) push token kaydı. Token cihaza özgü ve unique — aynı token
 * iki userId'ye atanmamalıdır (Expo aynı cihazda her uninstall+install'da yeni
 * token üretir). Yine de token'ın başka bir kullanıcıya bağlı olma ihtimaline
 * karşı upsert yapıyoruz: token unique key, mevcut kayıt varsa userId güncellenir
 * (cihaz devredildi senaryosu) ve lastSeenAt yenilenir.
 */
export const POST = withStaffRoute(async ({ request, dbUser }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz token verisi', 400)
  }

  const { token, platform, deviceName } = parsed.data

  await prisma.expoPushToken.upsert({
    where: { token },
    create: {
      userId: dbUser.id,
      token,
      platform,
      deviceName,
    },
    update: {
      userId: dbUser.id,
      platform,
      deviceName,
      lastSeenAt: new Date(),
    },
  })

  return jsonResponse({ message: 'Bildirim tokenı kaydedildi' }, 201)
})
