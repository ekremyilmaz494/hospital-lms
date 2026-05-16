import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getCached } from '@/lib/redis'
import { createAuditLog } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Rate limit: IP başına dakikada 10 auth denemesi
  // Vercel'de x-vercel-forwarded-for platform tarafından set edilir, spoof edilemez
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const allowed = await checkRateLimit(`auth:${ip}`, 10, 60)
  if (!allowed) {
    return NextResponse.redirect(`${origin}/auth/login?error=rate_limited`)
  }
  // Open redirect önlemi — URL parse ederek sadece aynı origin'e izin ver
  const rawRedirect = searchParams.get('redirectTo') ?? '/'
  let redirectTo = '/'
  try {
    // Absolute URL ise origin eşleşmesi zorunlu; relative path decode edilip kontrol edilir
    const resolved = new URL(rawRedirect, origin)
    if (resolved.origin === origin) {
      redirectTo = resolved.pathname + resolved.search + resolved.hash
    }
  } catch {
    // Geçersiz URL — varsayılan '/' kullan
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // İmpersonation token varsa Redis'ten doğrula ve audit log yaz
      const impToken = searchParams.get('imp_token')
      if (impToken) {
        const impData = await getCached<{
          impersonatedBy: string
          impersonatorName: string
          targetUserId: string
        }>(`impersonation:${impToken}`)
        if (impData) {
          await createAuditLog({
            userId: impData.impersonatedBy,
            action: 'impersonate_login',
            entityType: 'user',
            entityId: impData.targetUserId,
            newData: { impersonatorName: impData.impersonatorName },
            request,
          }).catch(() => {})
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
