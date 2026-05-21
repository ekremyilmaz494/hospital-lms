/**
 * Yıkıcı scriptlerin (wipe-*, setup, seed-*, vb.) yanlışlıkla PRODUCTION
 * veritabanına çalıştırılmasını engelleyen koruma.
 *
 * 2026-05-20 incident: `wipe-auth-users` + `wipe-orgs --execute` production
 * üzerinde çalıştırıldı; tüm personelin `auth.users` şifreleri kayboldu ve
 * hastane sisteme kilitlendi. Bu guard, aynı kazanın tekrarını önler.
 *
 * Tespit: bağlantı env değişkenlerinden HERHANGİ BİRİ canlı Supabase proje
 * ref'ini içeriyorsa production kabul edilir. Script ister Postgres URL'i
 * (`DATABASE_URL`) ister Supabase API URL'i (`NEXT_PUBLIC_SUPABASE_URL`)
 * kullansın — guard ikisini de tarar. Bilerek çalıştırmak için açık bayrak şart.
 *
 * `.cjs` ikizi: `_guard.cjs` (JS/MJS scriptleri için — aynı mantık).
 */

/** Hospital LMS canlı (production) Supabase proje ref'leri. */
const PRODUCTION_PROJECT_REFS = ['pkkkyyajfmusurcoovwt']

/** Bu bayrak verilirse production'da çalışmaya izin verilir (bilinçli onay). */
const OVERRIDE_FLAG = '--i-understand-production'

/**
 * Guard'ın taradığı bağlantı env değişkenleri. Bir script hangi yolla
 * bağlanırsa bağlansın (Postgres veya Supabase API) prod ref'i yakalanır.
 */
const CONNECTION_ENV_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
] as const

/**
 * Bağlantı env'lerinden biri production proje ref'ini içeriyorsa o ref'i,
 * içermiyorsa `null` döner. Abort etmez — karar veren tarafa bırakır.
 * Hem `assertNotProduction` hem de "prod'da sadece atla" isteyen scriptler
 * (ör. `sync-db`) bunu kullanır.
 */
export function isProductionTarget(): string | null {
  const haystack = CONNECTION_ENV_VARS.map((k) => process.env[k] ?? '').join(' ')
  return PRODUCTION_PROJECT_REFS.find((ref) => haystack.includes(ref)) ?? null
}

/**
 * Script production DB'ye bağlanıyorsa ve override bayrağı yoksa süreci durdurur.
 * Yıkıcı scriptlerin `main()` fonksiyonunun EN BAŞINDA çağrılmalıdır.
 *
 * @param scriptName Log mesajlarında görünecek script adı.
 */
export function assertNotProduction(scriptName = 'Bu script'): void {
  const ref = isProductionTarget()
  const hasOverride = process.argv.includes(OVERRIDE_FLAG)

  if (ref && !hasOverride) {
    console.error('')
    console.error('🛑 DURDURULDU — PRODUCTION KORUMASI')
    console.error(`   ${scriptName} canlı veritabanına bağlanıyor (proje: ${ref}).`)
    console.error('   Bu yıkıcı bir script ve PRODUCTION verisini bozar.')
    console.error(`   Gerçekten production'da çalıştırman gerekiyorsa: ${OVERRIDE_FLAG}`)
    console.error('')
    process.exit(1)
  }

  if (ref && hasOverride) {
    console.warn('')
    console.warn(`⚠️  PRODUCTION veritabanında çalışıyor — ${ref}`)
    console.warn(`   (${OVERRIDE_FLAG} verildi — bilinçli onay kabul edildi.)`)
    console.warn('')
  }
}
