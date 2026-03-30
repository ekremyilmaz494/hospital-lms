import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/redis'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Rate limit: IP başına dakikada 10 auth denemesi
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
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
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
