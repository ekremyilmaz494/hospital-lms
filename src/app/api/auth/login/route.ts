import { NextRequest, NextResponse } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit, getRedis } from '@/lib/redis'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'
import { isDemoMode, authenticateDemoUser, createDemoSessionValue, DEMO_SESSION_COOKIE } from '@/lib/demo-auth'

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
    const body = await request.json() as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return errorResponse('E-posta ve şifre gereklidir.', 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const ip = getTrustedIp(request)

    // ── Demo mode: Supabase yapılandırılmamışsa demo kullanıcılarla giriş ──
    if (isDemoMode()) {
      const demoUser = authenticateDemoUser(normalizedEmail, password)
      if (demoUser) {
        logger.info('auth:login', 'Demo giriş başarılı', { email: normalizedEmail, role: demoUser.role })
        const response = NextResponse.json({
          user: {
            id: demoUser.id,
            email: demoUser.email,
            role: demoUser.role,
          },
        })
        response.cookies.set(DEMO_SESSION_COOKIE, createDemoSessionValue(demoUser), {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 1 gün
          secure: process.env.NODE_ENV === 'production',
        })
        return response
      }
      return errorResponse('E-posta veya şifre hatalı. Demo bilgileri: super@demo.com / admin@demo.com / staff@demo.com — Şifre: demo123456', 401)
    }

    // ── Rate limiting + Supabase client oluşturma PARALEL ──
    // createClient() cookie parse'ı rate limit kontrolüyle eşzamanlı çalışır.
    // signInWithPassword() rate limit geçerse hemen başlar — ~200ms tasarruf.
    const [ipAllowed, emailAllowed, supabase] = await Promise.all([
      checkRateLimit(`login-ip:${ip}`, 15, 900),
      checkRateLimit(`login:${normalizedEmail}`, 8, 900),
      createClient(),
    ])
    if (!ipAllowed) {
      logger.warn('auth:login', 'IP rate limit aşıldı', { ip })
      return errorResponse('Çok fazla giriş denemesi. 15 dakika bekleyin.', 429)
    }
    if (!emailAllowed) {
      logger.warn('auth:login', 'E-posta rate limit aşıldı', { email: normalizedEmail })
      return errorResponse('Çok fazla giriş denemesi. 15 dakika bekleyin.', 429)
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (authError) {
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: normalizedEmail, ip })

      // Track consecutive failures — fire-and-forget (response'u bekletme)
      const redis = getRedis()
      if (redis) {
        const failKey = `login-fail:${normalizedEmail}`
        // Background: Redis ops + alert email — response'u bloklamaz
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
                }).catch(() => {})
              }
            }
          } catch { /* Redis failure tracking is best-effort */ }
        })()
      }

      return errorResponse('E-posta veya şifre hatalı.', 401)
    }

    const role = data.user?.user_metadata?.role as string | undefined

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

    logger.info('auth:login', 'Basarili giris', { userId: data.user?.id, role })

    return jsonResponse({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: role ?? 'staff',
      },
    })
  } catch (err) {
    logger.error('auth:login', 'Giriş işlemi sırasında beklenmeyen hata', err)
    return errorResponse('Bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }
}
