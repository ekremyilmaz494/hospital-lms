#!/usr/bin/env node
/**
 * Vercel build sırasında sadece PRODUCTION ortamında Prisma migration'ları uygular.
 *
 * Neden:
 * - Build komutuna `prisma migrate deploy` direkt koymak güvensiz — her preview
 *   deploy (PR build'leri) prod DB'ye migration göndermeye çalışır.
 * - VERCEL_ENV = "production" | "preview" | "development" olabilir.
 * - Sadece production'da çalıştırmak, preview build'lerinin prod şemayı
 *   değiştirmesini engeller ve her main merge'ünde migration otomatik uygulanır.
 *
 * Local (`pnpm build` Windows'ta çalıştırıldığında) VERCEL_ENV unset → skip.
 * Cross-platform: saf Node.js, bash gerektirmez.
 */
const { execSync } = require('node:child_process');

const env = process.env.VERCEL_ENV || 'unset';

if (env === 'production') {
  console.log('[migrate-on-prod] VERCEL_ENV=production → prisma migrate deploy çalıştırılıyor');
  try {
    execSync('prisma migrate deploy', { stdio: 'inherit' });
    console.log('[migrate-on-prod] Migrationlar basariyla uygulandi');
  } catch (err) {
    console.error('[migrate-on-prod] ✗ Migration başarısız — build durduruluyor');
    process.exit(1);
  }
} else {
  console.log(`[migrate-on-prod] VERCEL_ENV=${env} — migration skip (sadece production'da çalışır)`);
}
