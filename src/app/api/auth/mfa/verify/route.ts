import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

// MFA brute-force koruması: 5 dakikada en fazla 5 deneme
const MFA_RATE_LIMIT_WINDOW = 5 * 60   // saniye
const MFA_RATE_LIMIT_MAX = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  const user = session?.user
  if (authError || !user) return errorResponse('Oturum bulunamadı', 401)

  // Rate limiting: kullanıcı başına 5 dk / 5 deneme
  const allowed = await checkRateLimit(`mfa:verify:${user.id}`, MFA_RATE_LIMIT_MAX, MFA_RATE_LIMIT_WINDOW)
  if (!allowed) {
    logger.warn('mfa:verify', 'Rate limit aşıldı', { userId: user.id })
    return errorResponse('Çok fazla deneme. 5 dakika sonra tekrar deneyin.', 429)
  }

  const body = await request.json().catch(() => null)
  if (!body?.factorId || !body?.code) return errorResponse('Factor ID ve kod gereklidir', 400)

  const { factorId, code } = body as { factorId: string; code: string }

  // Girdi doğrulaması: factorId UUID formatında, code 6 haneli TOTP olmalı
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(factorId)) return errorResponse('Geçersiz factor ID formatı', 400)
  if (!/^\d{6}$/.test(code)) return errorResponse('Doğrulama kodu 6 haneli olmalıdır', 400)

  // Create challenge
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) return errorResponse('Doğrulama başlatılamadı', 400)

  // Verify code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })

  if (verifyError) {
    logger.info('mfa:verify', 'Basarisiz MFA dogrulama', { userId: user.id })
    return errorResponse('Geçersiz doğrulama kodu', 400)
  }

  logger.info('mfa:verify', 'Basarili MFA dogrulama', { userId: user.id })
  return jsonResponse({ success: true, aal: 'aal2' })
}
