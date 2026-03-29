import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return errorResponse('Oturum bulunamadı', 401)

  const body = await request.json().catch(() => null)
  if (!body?.factorId) return errorResponse('Factor ID gereklidir', 400)

  const { error } = await supabase.auth.mfa.unenroll({ factorId: body.factorId })
  if (error) return errorResponse(error.message, 400)

  logger.info('mfa:unenroll', 'MFA devre disi birakildi', { userId: user.id })
  return jsonResponse({ success: true })
}
