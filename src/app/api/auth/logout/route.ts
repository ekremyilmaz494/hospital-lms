import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Ignore signOut errors — we clear cookies regardless
  }

  // Build response and explicitly expire all Supabase auth cookies
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

  return response
}
