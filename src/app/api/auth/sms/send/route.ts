import { jsonResponse, errorResponse, getAuthUser } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { generateAndSendOtp } from '@/lib/auth/sms-otp'

/**
 * POST /api/auth/sms/send
 *
 * Oturum açmış kullanıcının (şifre doğrulaması geçmiş) telefonuna OTP gönderir.
 * Önkoşul: kullanıcı daha önce /api/auth/login ile authenticate olmuş olmalı
 * — bu endpoint standalone SMS servisi değil, login 2FA adımıdır.
 *
 * Rate limit: kullanıcı başına 10 dakikada 3 istek
 *   → brute-force'a karşı değil, SMS maliyetine karşı koruma.
 *   Brute-force'a karşı verify tarafındaki attempt counter korur.
 */

const RATE_WINDOW_SEC = 10 * 60
const RATE_MAX = 3

export async function POST() {
  const { user, dbUser, error } = await getAuthUser()
  if (error) return error
  if (!user || !dbUser) return errorResponse('Oturum bulunamadı', 401)

  // Telefon kontrolü
  if (!dbUser.phone) {
    return errorResponse('Hesabınıza telefon numarası tanımlı değil. Yöneticinizle iletişime geçin.', 400)
  }

  // Rate limit — SMS pahalı, kullanıcı başına sınırla
  const allowed = await checkRateLimit(`sms:send:${user.id}`, RATE_MAX, RATE_WINDOW_SEC)
  if (!allowed) {
    logger.warn('sms:send', 'Rate limit asildi', { userId: user.id })
    return errorResponse('Çok fazla SMS talebi. Lütfen birkaç dakika sonra tekrar deneyin.', 429)
  }

  const result = await generateAndSendOtp({ userId: user.id, phone: dbUser.phone })
  if (!result.success) {
    return errorResponse(result.error, 502)
  }

  // Telefonun son 4 hanesini UI'da gösterebilmesi için dön (güvenlik açığı değil,
  // kullanıcı zaten kendi numarasını biliyor)
  const masked = dbUser.phone.slice(-4).padStart(dbUser.phone.length, '*')
  return jsonResponse({ success: true, phoneMasked: masked })
}
