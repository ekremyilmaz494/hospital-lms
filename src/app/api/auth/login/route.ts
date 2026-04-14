import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getRateLimitCount, incrementRateLimit, deleteRateLimit, getRedis } from '@/lib/redis'
import { createLoginClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity-logger'

/**
 * Trusted IP extraction for Vercel deployments.
 * On Vercel, x-vercel-forwarded-for is set by the platform and cannot be spoofed
 * by clients (unlike x-forwarded-for which is a user-controlled header).
 * Falls back to x-forwarded-for for non-Vercel environments (still spoofable —
 * acceptable for rate limiting since worst case: attacker uses different IPs).
 */
function getTrustedIp(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** Threshold of consecutive failures before alerting admin */
const ALERT_THRESHOLD = 5

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string; rememberMe?: boolean }
    const { email, password, rememberMe = false } = body

    if (!email || !password) {
      return errorResponse('E-posta ve şifre gereklidir.', 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const ip = getTrustedIp(request)

    // ── Rate limiting (sadece başarısız girişler sayılır) + Supabase client PARALEL ──
    const [ipCount, emailCount, supabase] = await Promise.all([
      getRateLimitCount(`login-ip:${ip}`),
      getRateLimitCount(`login:${normalizedEmail}`),
      createLoginClient(rememberMe),
    ])
    if (ipCount >= 100) {
      logger.warn('auth:login', 'IP rate limit aşıldı', { ip })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }
    if (emailCount >= 30) {
      logger.warn('auth:login', 'E-posta rate limit aşıldı', { email: normalizedEmail })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }

    const authTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), 12000)
    )
    const { data, error: authError } = await Promise.race([
      supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
      authTimeout,
    ])

    if (authError) {
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: normalizedEmail, ip, reason: authError.message, code: authError.status })

      // Sadece başarısız girişlerde rate limit sayacını artır
      void Promise.all([
        incrementRateLimit(`login-ip:${ip}`, 300),
        incrementRateLimit(`login:${normalizedEmail}`, 300),
      ]).catch(() => {})

      // Track consecutive failures — fire-and-forget (response'u bekletme)
      const redis = getRedis()
      if (redis) {
        const failKey = `login-fail:${normalizedEmail}`
        void (async () => {
          try {
            await redis.set(failKey, 0, { nx: true, ex: 900 })
            const failCount = await redis.incr(failKey)
            if (failCount === ALERT_THRESHOLD) {
              const adminEmail = process.env.ADMIN_ALERT_EMAIL
              if (adminEmail) {
                sendEmail({
                  to: adminEmail,
                  subject: `[Güvenlik Uyarısı] ${normalizedEmail} için ${ALERT_THRESHOLD} başarısız giriş denemesi`,
                  html: `<p>IP: <strong>${ip}</strong><br>E-posta: <strong>${normalizedEmail}</strong><br>Zaman: ${new Date().toLocaleString('tr-TR')}</p><p>Bu kişi hesabına erişmeye çalışıyor olabilir. Lütfen kontrol edin.</p>`,
                }).catch(err => logger.warn('LoginAlert', 'Guvenlik uyari emaili gonderilemedi', (err as Error).message))
              }
            }
          } catch { /* Redis failure tracking is best-effort */ }
        })()
      }

      return errorResponse('E-posta veya şifre hatalı.', 401)
    }

    // ── Orphan user detection + active check ──
    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: { id: true, mustChangePassword: true, isActive: true, role: true, organizationId: true }
    })

    if (!dbUser) {
      // Orphan user — exists in Supabase Auth but not in DB
      return jsonResponse(
        { error: 'Hesabınız sistemde kayıtlı değil. Yöneticinizle iletişime geçin.' },
        403
      )
    }

    if (!dbUser.isActive) {
      return jsonResponse(
        { error: 'Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin.' },
        403
      )
    }

    const role = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | undefined

    // MFA check — session'daki factors bilgisinden kontrol et (HTTP call YOK).
    // signInWithPassword() response'unda user.factors her zaman döner.
    // Fallback API call'ı kaldırıldı — gereksiz ~400-800ms HTTP round-trip.
    const sessionFactors = data.session?.user?.factors
    const activeFactor = sessionFactors?.find(
      (f: { factor_type: string; status: string }) => f.factor_type === 'totp' && f.status === 'verified'
    ) as { id: string } | undefined

    if (activeFactor) {
      logger.info('auth:login', 'MFA gerekli', { userId: data.user?.id, role })
      return jsonResponse({
        mfaRequired: true,
        factorId: activeFactor.id,
      })
    }

    // Başarılı giriş — fail counter sıfırla
    void Promise.all([
      deleteRateLimit(`login:${normalizedEmail}`),
      deleteRateLimit(`login-fail:${normalizedEmail}`),
    ]).catch(() => {})

    logger.info('auth:login', 'Basarili giris', { userId: data.user?.id, role })

    void logActivity({
      userId: data.user.id,
      organizationId: dbUser.organizationId ?? '',
      action: 'login',
      ipAddress: ip,
    })

    return jsonResponse({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: role ?? 'staff',
      },
      mustChangePassword: dbUser.mustChangePassword,
    })
  } catch (err) {
    logger.error('auth:login', 'Giriş işlemi sırasında beklenmeyen hata', err)
    return errorResponse('Bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }
}
