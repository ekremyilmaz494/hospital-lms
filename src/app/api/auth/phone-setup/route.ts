import { jsonResponse, errorResponse, getAuthUser, parseBody } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/phone-setup
 * Body: { phone: string }
 *
 * Org SMS MFA açık ama kullanıcının telefonu yoksa, SMS verify akışına girmeden
 * önce buraya yönlendirilir. Telefon numarası kaydedilir (phoneVerifiedAt set
 * EDİLMEZ — sahiplik ancak SMS doğrulamasıyla kanıtlanır).
 */

function normalizeTrPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, '').replace(/^\+/, '')
  // Kabul edilen formatlar: 90XXXXXXXXXX (12), 0XXXXXXXXXX (11), XXXXXXXXXX (10)
  let digits = cleaned
  if (digits.startsWith('90') && digits.length === 12) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  // 5XXXXXXXXX (10 hane, 5 ile başlar) — TR cep telefonu
  if (!/^5\d{9}$/.test(digits)) return null
  // E.164 formatına çevir: +90XXXXXXXXXX
  return `+90${digits}`
}

export async function POST(request: Request) {
  const { user, dbUser, error } = await getAuthUser()
  if (error) return error
  if (!user || !dbUser) return errorResponse('Oturum bulunamadı', 401)

  const body = await parseBody<{ phone?: unknown }>(request)
  if (!body || typeof body.phone !== 'string') {
    return errorResponse('Telefon numarası gereklidir', 400)
  }

  const normalized = normalizeTrPhone(body.phone)
  if (!normalized) {
    return errorResponse('Geçerli bir Türkiye cep telefonu numarası girin (5XX XXX XX XX)', 400)
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: normalized,
        // phoneVerifiedAt SET EDİLMEZ — SMS doğrulamasıyla set edilir
        phoneVerifiedAt: null,
      },
    })
  } catch (err) {
    logger.error('auth:phone-setup', 'Telefon guncelleme basarisiz', err)
    return errorResponse('Telefon numarası kaydedilemedi', 500)
  }

  logger.info('auth:phone-setup', 'Telefon kaydedildi', { userId: user.id })
  return jsonResponse({ success: true })
}
