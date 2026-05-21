#!/usr/bin/env node
/**
 * check-script-guards.mjs — CI guard'ı.
 *
 * Yıkıcı / test-only scriptlerin production guard'ını (`_guard`) import ettiğini
 * doğrular. 2026-05-20 incident sonrası eklendi: o gün guard hiç yoktu ve
 * `wipe-*` scriptleri prod'a çalıştırıldı. Bu kontrol, guard'ı EKLEMEYİ
 * UNUTMAYI mümkün kılmaz — guard'sız yıkıcı bir script CI'da PR'ı bloklar.
 *
 * İki şekilde yakalar:
 *   1. REQUIRED listesi — guard'lı olması zorunlu, bilinen scriptler.
 *   2. Pattern tespiti — adı `wipe-*`/`reset-*` olan ya da yıkıcı SQL/Prisma
 *      pattern'i içeren YENİ scriptler (liste güncellenmese bile yakalanır).
 *
 * Çalıştırma: `node scripts/check-script-guards.mjs`  (CI'da otomatik)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Guard'ı MUTLAKA import etmesi gereken scriptler (yıkıcı veya test-only).
 * Kontrol diskteki dosyalar üzerinde döner; listede olup diskte olmayan dosya
 * (ör. `seed-auth-users.mjs` gitignore'lı, local-only) sessizce atlanır —
 * varsa kontrol edilir, yoksa sorun olmaz.
 */
const REQUIRED = [
  'wipe-auth-users.ts',
  'wipe-orgs.ts',
  'setup.js',
  'seed-demo.js',
  'seed-auth-users.mjs', // gitignore'lı / local-only — varsa guard'lı olmalı
  'setup-e2e-users.ts',
  'sync-db.js',
]

/**
 * Bilinçli olarak guard'sız bırakılan scriptler. `migrate-on-prod` ve
 * `prisma-migrate-prod-only` prod migration'ın SANCTIONED yoludur (Vercel
 * build) — guard koymak burada anlamsız ve build'i kırar.
 */
const ALLOWLIST = new Set([
  'migrate-on-prod.js',
  'prisma-migrate-prod-only.js',
  '_guard.ts',
  '_guard.cjs',
  'check-script-guards.mjs',
])

/** Yeni scriptlerde yıkıcı içerik işareti — guard yoksa yakalanır. */
const DESTRUCTIVE_PATTERNS = [
  /DELETE\s+FROM/i,
  /\bTRUNCATE\b/i,
  /--accept-data-loss/,
  /migrate\s+deploy/,
  /\.deleteMany\(/,
  /session_replication_role/,
]

/** Guard import'unun varlığını gösteren işaret. */
const GUARD_MARKER = /assertNotProduction|isProductionTarget/

const files = readdirSync(SCRIPTS_DIR).filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
const errors = []

for (const file of files) {
  if (ALLOWLIST.has(file)) continue

  const content = readFileSync(join(SCRIPTS_DIR, file), 'utf8')
  const hasGuard = GUARD_MARKER.test(content)

  const isRequired = REQUIRED.includes(file)
  const looksDestructive =
    /^(wipe|reset)-/.test(file) || DESTRUCTIVE_PATTERNS.some((p) => p.test(content))

  if ((isRequired || looksDestructive) && !hasGuard) {
    const reason = isRequired ? 'REQUIRED listesinde' : 'yıkıcı pattern içeriyor'
    errors.push(`  ✗ ${file} — ${reason} ama production guard import etmiyor`)
  }
}

if (errors.length > 0) {
  console.error('\n🛑 Guard kontrolü BAŞARISIZ — yıkıcı scriptlerde production guard eksik:\n')
  console.error(errors.join('\n'))
  console.error('\nÇözüm: scriptin başına guard çağrısı ekleyin:')
  console.error("  .ts scriptleri:      import { assertNotProduction } from './_guard'")
  console.error("  .js / .mjs scriptleri: ... from './_guard.cjs'")
  console.error('Script kasıtlı olarak prod\'da çalışıyorsa check-script-guards.mjs ALLOWLIST\'ine ekleyin.\n')
  process.exit(1)
}

console.log(`✓ Guard kontrolü: ${files.length} script tarandı — yıkıcı scriptlerin hepsi guard'lı.`)
