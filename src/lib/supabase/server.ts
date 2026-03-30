import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Why getUser() instead of getSession()?
 *
 * getSession() returns the session object from the LOCAL cookie without
 * making a network call to Supabase. This means a tampered or expired JWT
 * stored in the cookie would still be considered valid — making it unsafe
 * for authorization decisions.
 *
 * getUser() makes a server-side request to Supabase Auth and cryptographically
 * validates the JWT. Always use getUser() in API routes and Server Components
 * where security matters. getSession() is acceptable only for non-sensitive
 * client-side reads (e.g. pre-populating a form with the user's email).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
