/**
 * Yıkıcı scriptlerin (wipe-*, reset-*, vb.) yanlışlıkla PRODUCTION
 * veritabanına çalıştırılmasını engelleyen koruma.
 *
 * 2026-05-20 incident: `wipe-auth-users` + `wipe-orgs --execute` production
 * (`DATABASE_URL="$DIRECT_URL"`) üzerinde çalıştırıldı; tüm personelin
 * `auth.users` şifreleri kayboldu ve hastane sisteme kilitlendi. Bu guard,
 * aynı kazanın tekrarını önler.
 *
 * Tespit: `DATABASE_URL`/`DIRECT_URL` canlı Supabase proje ref'ini içeriyorsa
 * production kabul edilir. Bilerek çalıştırmak için açık bir bayrak şarttır.
 */

/** Hospital LMS canlı (production) Supabase proje ref'leri. */
const PRODUCTION_PROJECT_REFS = ['pkkkyyajfmusurcoovwt']

/** Bu bayrak verilirse production'da çalışmaya izin verilir (bilinçli onay). */
const OVERRIDE_FLAG = '--i-understand-production'

/**
 * Script production DB'ye bağlanıyorsa ve override bayrağı yoksa süreci durdurur.
 * Yıkıcı scriptlerin `main()` fonksiyonunun EN BAŞINDA çağrılmalıdır.
 *
 * @param scriptName Log mesajlarında görünecek script adı.
 */
export function assertNotProduction(scriptName = 'Bu script'): void {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? ''
  const ref = PRODUCTION_PROJECT_REFS.find((r) => url.includes(r))
  const hasOverride = process.argv.includes(OVERRIDE_FLAG)

  if (ref && !hasOverride) {
    const masked = url.replace(/:\/\/[^@]+@/, '://***@')
    console.error('')
    console.error('🛑 DURDURULDU — PRODUCTION KORUMASI')
    console.error(`   ${scriptName} canlı veritabanına bağlanıyor (proje: ${ref}).`)
    console.error(`   Hedef: ${masked}`)
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
