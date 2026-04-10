/**
 * sync-db.js — Dev başlatılmadan önce Prisma schema'yı DB ile senkronize eder.
 * PgBouncer prepared statement sorunu nedeniyle DIRECT_URL (port 5432) kullanır.
 * Hata olursa sessizce devam eder (DB'ye erişim yoksa dev yine başlar).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { execFileSync } = require('child_process');

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.log('[sync-db] DIRECT_URL tanımlı değil, db push atlanıyor.');
  process.exit(0);
}

try {
  console.log('[sync-db] Schema → DB senkronizasyonu başlıyor...');
  execFileSync('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--url', directUrl], {
    stdio: 'inherit',
    timeout: 30000,
  });
  console.log('[sync-db] ✓ DB senkronize edildi.');
} catch (err) {
  console.warn('[sync-db] ⚠ DB push başarısız oldu (dev yine başlayacak):', err.message?.substring(0, 100));
}
