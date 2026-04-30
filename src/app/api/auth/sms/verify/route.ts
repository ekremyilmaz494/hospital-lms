import { cookies } from 'next/headers'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { verifyOtp } from '@/lib/auth/sms-otp'
import { issueTrustedDevice } from '@/lib/auth/trusted-device'
import { markSmsVerifiedInSession } from '@/lib/auth/sms-session'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/sms/verify
 * Body: { code: string, rememberDevice?: boolean }
 *
 * Akış:
 *   1. Oturum kontrolü (şifre adımı geçmiş olmalı)
 *   2. Rate limit (kullanıcı başına 5dk/10 verify denemesi — brute-force guard)
 *   3. OTP doğrulama (sms-otp.ts)
 *   4. Başarılıysa:
 *      a. User.phoneVerifiedAt = now (ilk doğrulamaysa telefon sahipliği onaylandı)
 *      b. rememberDevice=true ise trusted device token issue et
 *      c. "sms_verified" cookie set et (session seviyesinde, middleware için)
 *   5. Yönlendirme URL'i dön — client role'e göre yönlendirsin
 */

const VERIFY_RATE_WINDOW_SEC = 5 * 60
const VERIFY_RATE_MAX = 10

interface VerifyBody {
  code?: unknown
  rememberDevice?: unknown
}

export const POST = withStaffRoute(async ({ request, user, dbUser }) => {
  // Rate limit — brute-force için net sınır
  const allowed = await checkRateLimit(`sms:verify:${user.id}`, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW_SEC)
  if (!allowed) {
    logger.warn('sms:verify', 'Rate limit asildi', { userId: user.id })
    return errorResponse('Çok fazla deneme. 5 dakika sonra tekrar deneyin.', 429)
  }

  const body = await parseBody<VerifyBody>(request)
  if (!body) return errorResponse('Geçersiz istek', 400)

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const rememberDevice = body.rememberDevice === true

  if (!/^\d{6}$/.test(code)) {
    return errorResponse('Doğrulama kodu 6 haneli olmalıdır', 400)
  }

  if (!dbUser.phone) {
    return errorResponse('Hesabınıza telefon tanımlı değil', 400)
  }

  const result = await verifyOtp({
    userId: user.id,
    submittedCode: code,
    expectedPhone: dbUser.phone,
  })

  if (!result.ok) {
    const status = result.reason === 'too_many_attempts' ? 429 : 400
    return errorResponse(result.message, status)
  }

  // Başarılı — telefon doğrulandı işaretle (ilk kez doğrulanıyorsa)
  if (!dbUser.phoneVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date() },
    }).catch((err) => {
      logger.error('sms:verify', 'phoneVerifiedAt guncelleme basarisiz', err)
    })
  }

  // Session seviyesinde "sms verified" işareti — layout guard bunu okur
  await markSmsVerifiedInSession()

  // SMS pending cookie'yi sil — middleware artık dashboard'a izin versin
  const cookieStore = await cookies()
  cookieStore.delete('hlms-sms-pending')

  // Güvenilir cihaz token'ı — kullanıcı "beni hatırla" işaretlediyse
  if (rememberDevice) {
    const ua = request.headers.get('user-agent')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')
    await issueTrustedDevice({ userId: user.id, userAgent: ua, ipAddress: ip })
  }

  // Rol bazlı redirect target — client tarafı yönlendirecek
  const roleRoutes: Record<string, string> = {
    super_admin: '/super-admin/dashboard',
    admin: '/admin/dashboard',
    staff: '/staff/dashboard',
  }
  const redirectTo = roleRoutes[dbUser.role] ?? '/'

  logger.info('sms:verify', 'Basarili SMS dogrulama', { userId: user.id, rememberDevice })
  return jsonResponse({ success: true, redirectTo })
}, { requireOrganization: true })
