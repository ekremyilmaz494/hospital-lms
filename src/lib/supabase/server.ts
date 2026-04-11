import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * getSession() vs getUser():
 *
 * getSession() — local JWT parse, no HTTP call. Fast (~0ms) but cannot detect
 * revoked tokens. Used by getAuthUser() for most API routes.
 *
 * getUser() — HTTP call to Supabase Auth, cryptographically validates JWT.
 * Slower (~100-150ms) but catches revoked/expired tokens.
 * Used by getAuthUserStrict() for security-critical operations
 * (password changes, user CRUD, admin operations).
 *
 * NOTE: Middleware skips /api/* routes — API auth relies solely on
 * getAuthUser()/getAuthUserStrict() in api-helpers.ts.
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
