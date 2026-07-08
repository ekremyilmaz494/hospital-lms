import { createBrowserClient } from '@supabase/ssr'
import { getCookieDomain } from './cookie-domain'
import { getSupabaseCookieOptions, readBrowserConfig } from './onprem-config'

/** Supabase credentials mevcut mu? On-prem'de runtime (window.__ONPREM_CONFIG__), aksi baked. */
export const hasSupabaseCredentials =
  (!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof window !== 'undefined' && !!readBrowserConfig())

const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60

/** Sentinel cookie `hlms-remember-me=1` set'lenmiş mi? Login route'u set eder. */
function hasRememberMeFlag(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .some((c) => c.trim() === 'hlms-remember-me=1')
}

/**
 * Cookie attribute'larını obje formuna serialize eder (document.cookie set'i için).
 * Multi-tenant için Domain= eklenir ki subdomain'ler arası session paylaşımı çalışsın.
 */
function serializeCookie(name: string, value: string, options: Record<string, unknown> = {}): string {
  const domain = getCookieDomain()
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`]

  if (domain) parts.push(`Domain=${domain}`)
  if (typeof options.path === 'string') parts.push(`Path=${options.path}`)
  else parts.push('Path=/')
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${options.maxAge}`)
  if (typeof options.expires === 'string') parts.push(`Expires=${options.expires}`)
  if (typeof options.sameSite === 'string') parts.push(`SameSite=${options.sameSite}`)
  else parts.push('SameSite=Lax')
  if (options.secure) parts.push('Secure')

  return parts.join('; ')
}

function parseCookies(): Array<{ name: string; value: string }> {
  if (typeof document === 'undefined') return []
  return document.cookie
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [name, ...valueParts] = chunk.split('=')
      return { name, value: decodeURIComponent(valueParts.join('=')) }
    })
}

export function createClient() {
  // On-prem: runtime config (window.__ONPREM_CONFIG__) baked localhost'u ezer; bulutta
  // config null → baked NEXT_PUBLIC_* kullanılır (davranış bit-bit aynı).
  const rt = readBrowserConfig()
  return createBrowserClient(
    rt?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    rt?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return parseCookies()
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          // Sentinel her setAll'da yeniden okunur — login/logout sırasında flag değişebilir,
          // sadece tek sayfa load'unda cache'lemek refresh sonrası state'i bozar.
          const rememberMe = hasRememberMeFlag()
          for (const { name, value, options } of cookiesToSet) {
            const baseOpts = options as Record<string, unknown>
            const opts = (rememberMe && name.includes('-auth-token'))
              ? { ...baseOpts, maxAge: REMEMBER_ME_MAX_AGE }
              : baseOpts
            document.cookie = serializeCookie(name, value, opts)
          }
        },
      },
    }
  )
}
