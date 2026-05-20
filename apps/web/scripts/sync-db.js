/**
 * sync-db.js — Dev başlatılmadan önce Prisma schema'yı DB ile senkronize eder.
 * PgBouncer prepared statement sorunu nedeniyle DIRECT_URL (port 5432) kullanır.
 * Hata olursa sessizce devam eder (DB'ye erişim yoksa dev yine başlar).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { execSync } = require('child_process');
const { isProductionTarget } = require('./_guard.cjs');

// PRODUCTION KORUMASI — sync-db `predev`'de her `pnpm dev`'de çalışır. Laptoptan
// prod'a migration deploy etmek YASAK (2026-05-20 incident). Burada abort
// ETMİYORUZ (dev yine başlasın); sadece prod'a migrate'i atlıyoruz.
// Prod migration'ı yalnızca Vercel build'inde (prisma-migrate-prod-only.js) çalışır.
const prodRef = isProductionTarget();
if (prodRef) {
  console.warn(`[sync-db] ⚠ Prod tespit edildi (${prodRef}) — migrate deploy ATLANDI.`);
  console.warn('[sync-db]   Laptoptan prod şeması değiştirilmez; dev normal başlıyor.');
  process.exit(0);
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.log('[sync-db] DIRECT_URL tanımlı değil, db push atlanıyor.');
  process.exit(0);
}

try {
  // Migrate deploy Frankfurt'a 1-3s round-trip yapar. Önce status ile pending var mı bak;
  // yoksa deploy'u atla (no-op için Frankfurt'a gitme).
  const status = execSync('pnpm exec prisma migrate status', {
    encoding: 'utf-8',
    timeout: 20000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const upToDate = /Database schema is up to date|No pending migrations to apply/i.test(status);
  if (upToDate) {
    console.log('[sync-db] ✓ DB zaten güncel — migrate deploy atlandı.');
  } else {
    console.log('[sync-db] Pending migration tespit edildi, deploy ediliyor...');
    execSync('pnpm exec prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log('[sync-db] ✓ DB senkronize edildi.');
  }
} catch (err) {
  console.warn('[sync-db] ⚠ DB sync başarısız oldu (dev yine başlayacak):', err.message?.substring(0, 100));
}
