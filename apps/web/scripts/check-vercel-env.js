#!/usr/bin/env node
/**
 * Vercel Production Env Checker
 * Vercel CLI kullanarak production ortamindaki env'leri dogrular.
 *
 * Kullanim: node scripts/check-vercel-env.js
 * Gereksinim: Vercel CLI kurulu ve login yapilmis olmali
 */

const { execSync } = require('node:child_process');
const { readFileSync, unlinkSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const EXPECTED_REF = 'pkkkyyajfmusurcoovwt';
const TMP_FILE = resolve(__dirname, '..', '.env.vercel.tmp');

// Vercel CLI kontrol
try {
  execSync('vercel --version', { stdio: 'pipe' });
} catch {
  console.log('\x1b[33m⚠ Vercel CLI kurulu degil veya PATH\'te yok.\x1b[0m');
  console.log('  Kurmak icin: npm i -g vercel');
  console.log('  Atlaniyor...');
  process.exit(0);
}

// Pull env
console.log('Vercel production env cekiliyor...');
try {
  execSync(`vercel env pull --environment=production "${TMP_FILE}" --yes`, {
    stdio: 'pipe',
    cwd: resolve(__dirname, '..'),
  });
} catch (err) {
  console.log('\x1b[31m✗ Vercel env cekilemedi. Login yapilmis mi?\x1b[0m');
  console.log('  vercel login');
  process.exit(1);
}

// Parse
if (!existsSync(TMP_FILE)) {
  console.log('\x1b[31m✗ .env.vercel.tmp olusturulamadi\x1b[0m');
  process.exit(1);
}

const content = readFileSync(TMP_FILE, 'utf8');
const vars = {};
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  vars[key] = val;
}

// Temizle
unlinkSync(TMP_FILE);

// Kontrol
const supabaseUrl = vars.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = supabaseUrl.match(/\/\/([^.]+)\.supabase/)?.[1] ?? 'bulunamadi';

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   VERCEL PRODUCTION ENV CHECK                ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');

if (ref === EXPECTED_REF) {
  console.log('\x1b[32m✅ NEXT_PUBLIC_SUPABASE_URL ref dogru: %s\x1b[0m', ref);
} else {
  console.log('\x1b[31m✗ NEXT_PUBLIC_SUPABASE_URL YANLIS PROJEYE ISARET EDIYOR!\x1b[0m');
  console.log('\x1b[31m  Beklenen: %s\x1b[0m', EXPECTED_REF);
  console.log('\x1b[31m  Bulunan:  %s\x1b[0m', ref);
  console.log('\x1b[31m  URL:      %s\x1b[0m', supabaseUrl);
}

const appUrl = vars.NEXT_PUBLIC_APP_URL ?? '';
if (appUrl.includes('localhost')) {
  console.log('\x1b[31m✗ NEXT_PUBLIC_APP_URL localhost iceiriyor: %s\x1b[0m', appUrl);
} else if (appUrl) {
  console.log('\x1b[32m✅ NEXT_PUBLIC_APP_URL: %s\x1b[0m', appUrl);
}

const dbUrl = vars.DATABASE_URL ?? '';
const dbRegion = dbUrl.match(/([a-z]{2}-[a-z]+-\d)/)?.[1] ?? 'bilinmiyor';
console.log('\x1b[32m✅ DB region: %s\x1b[0m', dbRegion);
console.log('');
