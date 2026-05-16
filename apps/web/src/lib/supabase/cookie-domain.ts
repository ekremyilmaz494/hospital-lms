/**
 * Cookie domain helper — multi-tenant subdomain session paylaşımı için.
 *
 * Production'da `NEXT_PUBLIC_BASE_DOMAIN=klinovax.com` set'liyse `.klinovax.com`
 * döner. Bu sayede `klinovax.com`'da login olan kullanıcı `devakent.klinovax.com`
 * subdomain'ine geçtiğinde Supabase auth cookie'si geçerli kalır.
 *
 * Dev'de (localhost) `undefined` döner — host-only cookie default davranışı korunur.
 *
 * Graceful migration: Eski host-only cookie'ler doğal olarak Supabase token refresh
 * sırasında shared-domain cookie ile üzerine yazılır. Force logout gerekmez.
 */
export function getCookieDomain(): string | undefined {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? ''
  if (!baseDomain) return undefined
  // localhost / IP / port'lu host'lar için domain set'leme
  if (baseDomain.includes('localhost') || baseDomain.includes(':')) return undefined
  // En az bir nokta içermeli (TLD'li gerçek domain)
  if (!baseDomain.includes('.')) return undefined
  return `.${baseDomain}`
}
