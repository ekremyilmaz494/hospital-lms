import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return errorResponse('Oturum bulunamadı', 401)

  const body = await request.json().catch(() => null)
  if (!body?.factorId || !body?.code) return errorResponse('Factor ID ve kod gereklidir', 400)

  const { factorId, code } = body as { factorId: string; code: string }

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
