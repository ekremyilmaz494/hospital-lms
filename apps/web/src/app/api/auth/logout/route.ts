import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withStaffRoute } from '@/lib/api-handler'
import { logActivity } from '@/lib/activity-logger'

export const POST = withStaffRoute(async ({ dbUser }) => {
  // Kullanıcı bilgisini signOut'tan ÖNCE al — sonra session silinir
  if (dbUser.id && dbUser.organizationId) {
    void logActivity({
      userId: dbUser.id,
      organizationId: dbUser.organizationId,
      action: 'logout',
    })
  }

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
    'hlms-remember-me', // "7 gün açık tut" sentinel cookie
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
})
