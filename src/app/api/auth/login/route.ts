import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'

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

    // ── IP-based rate limiting ──
    const ipAllowed = await checkRateLimit(`login-ip:${ip}`, 20, 900)
    if (!ipAllowed) {
      logger.warn('auth:login', 'IP rate limit aşıldı', { ip })
      return errorResponse('Çok fazla giriş denemesi. 15 dakika bekleyin.', 429)
    }

    // ── Email-based rate limiting ──
    const emailAllowed = await checkRateLimit(`login:${normalizedEmail}`, 5, 900)
    if (!emailAllowed) {
      logger.warn('auth:login', 'E-posta rate limit aşıldı', { email: normalizedEmail })
      return errorResponse('Çok fazla giriş denemesi. 15 dakika bekleyin.', 429)
    }

    // ── Supabase auth ──
    const supabase = await createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (authError) {
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: normalizedEmail, ip })

      // Track consecutive failures for this email to alert admin at threshold
      const failKey = `login-fail:${normalizedEmail}`
      const { getRedis } = await import('@/lib/redis')
      const redis = getRedis()
      if (redis) {
        await redis.set(failKey, 0, { nx: true, ex: 900 })
        const failCount = await redis.incr(failKey)
        if (failCount === ALERT_THRESHOLD) {
          const adminEmail = process.env.ADMIN_ALERT_EMAIL
          if (adminEmail) {
            sendEmail({
              to: adminEmail,
              subject: `[Güvenlik Uyarısı] ${normalizedEmail} için ${ALERT_THRESHOLD} başarısız giriş denemesi`,
              html: `<p>IP: <strong>${ip}</strong><br>E-posta: <strong>${normalizedEmail}</strong><br>Zaman: ${new Date().toLocaleString('tr-TR')}</p><p>Bu kişi hesabına erişmeye çalışıyor olabilir. Lütfen kontrol edin.</p>`,
            }).catch(() => {}) // Email hatası login akışını bozmasın
          }
        }
      }

      return errorResponse('E-posta veya şifre hatalı.', 401)
    }

    const role = data.user?.user_metadata?.role as string | undefined

    // Check if user has MFA enrolled
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const activeFactor = factors?.totp?.find(f => f.status === 'verified')

    if (activeFactor) {
      logger.info('auth:login', 'MFA gerekli', { userId: data.user?.id, role })
      return jsonResponse({
        mfaRequired: true,
        factorId: activeFactor.id,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          role: role ?? 'staff',
        },
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
