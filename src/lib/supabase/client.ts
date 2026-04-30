import { createBrowserClient } from '@supabase/ssr'
import { getCookieDomain } from './cookie-domain'

/** Supabase credentials mevcut mu? */
export const hasSupabaseCredentials =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookies()
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializeCookie(name, value, options as Record<string, unknown>)
          }
        },
      },
    }
  )
}
