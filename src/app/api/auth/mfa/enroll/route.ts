import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  const user = session?.user
  if (authError || !user) return errorResponse('Oturum bulunamadı', 401)

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator',
  })

  if (error) return errorResponse(error.message, 400)

  return jsonResponse({
    factorId: data.id,
    qrCode: data.totp.qr_code,
  })
}
