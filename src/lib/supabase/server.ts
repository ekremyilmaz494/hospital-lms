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

/**
 * Login işlemi için özel client — rememberMe seçeneğine göre cookie maxAge'i ayarlar.
 *
 * rememberMe=true  → maxAge=604800 (7 gün): tarayıcı kapansa da oturum devam eder.
 * rememberMe=false → maxAge kaldırılır (session cookie): tarayıcı kapanınca oturum sona erer.
 *
 * Neden 7 gün: 30 gün sağlık uygulamaları için uzun, paylaşımlı cihaz riski var.
 * 7 gün KVKK ve sektör standardına uygun bir denge.
 */
export async function createLoginClient(rememberMe: boolean) {
  const cookieStore = await cookies()
  const SEVEN_DAYS = 7 * 24 * 60 * 60

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
            cookiesToSet.forEach(({ name, value, options }) => {
              const overriddenOptions = rememberMe
                ? { ...options, maxAge: SEVEN_DAYS }
                : { ...options, maxAge: undefined }
              cookieStore.set(name, value, overriddenOptions)
            })
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
