#!/usr/bin/env node
/**
 * Production-only Prisma migrate runner.
 *
 * Why: PR preview build'lerinde DB env vars (DATABASE_URL, DIRECT_URL) Vercel
 * Preview scope'una eklenmediği için `prisma migrate deploy` çakılıyor:
 *   "The datasource.url property is required when using prisma migrate deploy."
 * Tüm preview build'leri ERROR olarak düşüyordu. Preview'dan zaten prod DB'ye
 * migrate atmak istemiyoruz — bu sadece production deploy'ında çalışmalı.
 *
 * Davranış:
 *   - VERCEL_ENV === 'production' → migrate çalıştır, hata olursa exit 1
 *   - VERCEL_ENV !== 'production' (preview / development / unset) → log + skip
 *
 * Lokal `pnpm build` çalıştırırken VERCEL_ENV unset olduğu için migrate atlanır;
 * geliştiriciler şemayı `pnpm db:migrate` ile yönetir, build'in yan etkisi
 * istenmez.
 */

const { spawnSync } = require('node:child_process')

const env = process.env.VERCEL_ENV || 'unset'

if (env !== 'production') {
  console.log(`[prisma-migrate] VERCEL_ENV=${env} — prod değil, migrate atlanıyor.`)
  process.exit(0)
}

console.log('[prisma-migrate] production build — prisma migrate deploy çalıştırılıyor…')
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: false,
})

if (result.status !== 0) {
  console.error(`[prisma-migrate] migrate deploy başarısız (exit ${result.status})`)
  process.exit(result.status ?? 1)
}
