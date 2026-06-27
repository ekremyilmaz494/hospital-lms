import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/mfa
 * Giriş yapan kullanıcının TOTP (authenticator) faktör durumunu döner.
 * Supabase native MFA kaynak alınır (`auth.mfa_factors`) — ayrı DB kolonu tutulmaz.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (authError || !session?.user) return errorResponse('Oturum bulunamadı', 401)

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return errorResponse(error.message, 400)

  const totp = (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status,
    createdAt: f.created_at,
  }))

  return jsonResponse(
    { totp, enabled: totp.length > 0 },
    200,
    { 'Cache-Control': 'private, no-store' },
  )
}
