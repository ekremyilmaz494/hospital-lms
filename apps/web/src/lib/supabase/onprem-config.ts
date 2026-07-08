import { isOnPrem } from '@/lib/deployment'

/**
 * On-prem Supabase kablolaması — bulut yolunu DEĞİŞTİRMEDEN (isOnPrem/SUPABASE_URL kapılı).
 *
 * On-prem mimari gerçeği: tarayıcı gateway'e (Kong) HOST'ta yayınlanmış URL'den
 * (`NEXT_PUBLIC_SUPABASE_URL`, ör. http://localhost:8000) erişir; konteynerdeki SUNUCU ise
 * gateway'e İÇ DNS'ten (`http://gateway:8000`) erişmek zorundadır — konteyner içinde
 * `localhost:8000`'de servis YOKTUR (ECONNREFUSED). `NEXT_PUBLIC_*` build-time koda gömülü
 * olduğundan runtime'da değiştirilemez; bu yüzden sunucu-taraf çağrılar ayrı bir runtime
 * env'inden (`SUPABASE_URL`) URL okumalıdır.
 */

/**
 * Sunucu-taraf Supabase istemcileri/çağrıları için auth URL'i.
 * On-prem: runtime `SUPABASE_URL` (compose: http://gateway:8000) — iç gateway.
 * Bulut: `SUPABASE_URL` tanımsız → `NEXT_PUBLIC_SUPABASE_URL`'e düşer, davranış bit-bit aynı.
 * DİKKAT: yalnız SUNUCU→GoTrue çağrıları için; TARAYICI-yüzlü (SSO redirect vb.) URL'lere
 * ASLA uygulanmaz (tarayıcı iç gateway host'unu çözemez).
 */
export function getServerSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
}

/**
 * On-prem'de çerez adını SABİTLE. Tarayıcı (yayınlanmış gateway host) ile sunucu (iç gateway
 * host) farklı URL kullandığından, @supabase/ssr'ın host-türevli storageKey'i çerez adını
 * ayrıştırır (`sb-localhost-auth-token` vs `sb-gateway-auth-token`) → giriş 200 dönse bile
 * oturum kopar. Sabit ad ikisini eşitler.
 *
 * Bulut: undefined → @supabase/ssr varsayılanı (`sb-<ref>-auth-token`) ve mevcut oturumlar korunur.
 * KISIT: ad MUTLAKA 'sb-' öneki + '-auth-token' içermeli — middleware/api-helpers fast-path'leri
 * (`startsWith('sb-') && includes('-auth-token')`) ve remember-me maxAge override'ları bu desene
 * bakar; @supabase/ssr chunking'i de storageKey üstünden çalışır (`sb-onprem-auth-token.0/.1`).
 */
export function getSupabaseCookieOptions(): { name: string } | undefined {
  return isOnPrem() ? { name: 'sb-onprem-auth-token' } : undefined
}

/**
 * Tarayıcı-yüzlü RUNTIME config — tek generic on-prem imajı için.
 *
 * NEDEN: `NEXT_PUBLIC_*` değerleri Next.js tarafından BUILD anında (server component'te
 * bile) koda inline edilir → registry'den çekilen tek imaj 'localhost'a kilitlenir; hastane
 * LAN/domaininde tarayıcı-taraflı Supabase auth/realtime KIRILIR. Çözüm: değerleri runtime'da
 * enjekte et — root layout (server) `getBrowserRuntimeConfig()`'i okur, `window.__ONPREM_CONFIG__`'e
 * basar; tarayıcı `readBrowserConfig()` ile oradan okur. Değerler NON-NEXT_PUBLIC env'den gelir
 * (`ONPREM_PUBLIC_*`) — bunlar inline EDİLMEZ, runtime'da compose/.env'den okunur.
 *
 * Bulut: isOnPrem=false → getBrowserRuntimeConfig null → window global basılmaz →
 * readBrowserConfig null → her yer baked `NEXT_PUBLIC_*`'e düşer (davranış bit-bit aynı).
 * anon key zaten PUBLIC (NEXT_PUBLIC) — window'a basmak yeni ifşa DEĞİL.
 */
export interface OnpremBrowserConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  storageHost: string
  appUrl: string
  baseDomain: string
}

/** SUNUCU: runtime env'den tarayıcı config'i (yalnız on-prem + zorunlu alanlar dolu). Aksi null. */
export function getBrowserRuntimeConfig(): OnpremBrowserConfig | null {
  if (!isOnPrem()) return null
  const supabaseUrl = process.env.ONPREM_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.ONPREM_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return {
    supabaseUrl,
    supabaseAnonKey,
    storageHost: process.env.ONPREM_PUBLIC_STORAGE_HOST ?? '',
    appUrl: process.env.ONPREM_PUBLIC_APP_URL ?? '',
    baseDomain: process.env.ONPREM_PUBLIC_BASE_DOMAIN ?? '',
  }
}

/** İZOMORFİK: tarayıcıdaki runtime config (window.__ONPREM_CONFIG__). Bulut/SSR'da null. */
export function readBrowserConfig(): OnpremBrowserConfig | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { __ONPREM_CONFIG__?: OnpremBrowserConfig }).__ONPREM_CONFIG__ ?? null
}

/**
 * `window.__ONPREM_CONFIG__` enjeksiyonu için güvenli inline script gövdesi.
 * `<` kaçırılır (JSON içinde `</script>` ile script'ten çıkışı engeller). Değerler operatör
 * .env'inden gelir (kullanıcı girdisi değil) ama defense-in-depth. Config null → boş string
 * (script hiç basılmaz — çağıran koşullar).
 */
export function serializeBrowserConfigScript(config: OnpremBrowserConfig | null): string {
  if (!config) return ''
  return `window.__ONPREM_CONFIG__=${JSON.stringify(config).replace(/</g, '\\u003c')}`
}
