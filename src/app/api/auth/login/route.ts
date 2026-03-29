import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return errorResponse('E-posta ve şifre gereklidir.', 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── IP-based rate limiting ──
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'

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
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: normalizedEmail })
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
