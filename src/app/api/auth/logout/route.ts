import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_SESSION_COOKIE, isDemoMode } from '@/lib/demo-auth'

export async function POST() {
  if (!isDemoMode()) {
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore signOut errors — we clear cookies regardless
    }
  }

  // Build response and explicitly expire all Supabase auth cookies + demo cookie
  const response = NextResponse.json({ success: true })
  const supabaseCookieNames = [
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ]
  // Also clear any sb-<project>-auth-token pattern cookies
  supabaseCookieNames.forEach((name) => {
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
    })
  })

  // Demo session cookie'sini temizle
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
  })

  return response
}
