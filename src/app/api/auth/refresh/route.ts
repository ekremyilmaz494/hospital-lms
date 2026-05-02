import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * Mobile/native client'lar için token refresh endpoint'i.
 *
 * Web tarafı bu endpoint'i kullanmaz — Supabase SSR cookie handler'ı middleware'de
 * otomatik refresh yapar. Mobile cookie kullanmadığı için access token expire
 * olduğunda bu endpoint'e gidip yeni token çifti alır.
 *
 * Public route — auth kontrolü yok. Geçerli refresh token gerektiriyor; Supabase
 * yanlış/iptal edilmiş token için 401 döner.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { refreshToken?: string }
    const refreshToken = body.refreshToken?.trim()

    if (!refreshToken) {
      return errorResponse('refreshToken gereklidir.', 400)
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    )

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session) {
      logger.info('auth:refresh', 'Refresh token reddedildi', { reason: error?.message })
      return errorResponse('Oturum süreniz doldu. Lütfen tekrar giriş yapın.', 401)
    }

    return jsonResponse({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
        tokenType: data.session.token_type,
      },
    })
  } catch (err) {
    logger.error('auth:refresh', 'Refresh sırasında beklenmeyen hata', err)
    return errorResponse('Bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }
}
