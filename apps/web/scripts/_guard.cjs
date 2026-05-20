/**
 * _guard.cjs — `_guard.ts`'in CommonJS ikizi. JS/MJS scriptleri için.
 *
 * `.js` scriptleri:   const { assertNotProduction } = require('./_guard.cjs')
 * `.mjs` scriptleri:  import { assertNotProduction } from './_guard.cjs'
 *
 * Mantık `_guard.ts` ile birebir aynı tutulmalıdır — biri değişirse diğeri de.
 * Ayrıntılı açıklama için `_guard.ts`'e bakınız.
 */

/** Hospital LMS canlı (production) Supabase proje ref'leri. */
const PRODUCTION_PROJECT_REFS = ['pkkkyyajfmusurcoovwt']

/** Bu bayrak verilirse production'da çalışmaya izin verilir (bilinçli onay). */
const OVERRIDE_FLAG = '--i-understand-production'

/** Guard'ın taradığı bağlantı env değişkenleri (Postgres + Supabase API). */
const CONNECTION_ENV_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
]

/**
 * Bağlantı env'lerinden biri production proje ref'ini içeriyorsa o ref'i,
 * içermiyorsa `null` döner.
 * @returns {string | null}
 */
function isProductionTarget() {
  const haystack = CONNECTION_ENV_VARS.map((k) => process.env[k] || '').join(' ')
  return PRODUCTION_PROJECT_REFS.find((ref) => haystack.includes(ref)) || null
}

/**
 * Script production DB'ye bağlanıyorsa ve override bayrağı yoksa süreci durdurur.
 * @param {string} scriptName Log mesajlarında görünecek script adı.
 */
function assertNotProduction(scriptName = 'Bu script') {
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

module.exports = { assertNotProduction, isProductionTarget, OVERRIDE_FLAG }
