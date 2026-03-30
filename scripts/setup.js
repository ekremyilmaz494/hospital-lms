/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', env: { ...process.env, PATH: process.env.PATH } });
}

function log(step, total, msg, status = 'OK') {
  const icon = status === 'OK' ? '\x1b[32m✓\x1b[0m' : status === 'SKIP' ? '\x1b[33m⊘\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  [${step}/${total}] ${msg.padEnd(40)} ${icon}`);
}

async function setup() {
  const TOTAL = 7;
  console.log('\n\x1b[1m=== Hospital LMS Setup ===\x1b[0m\n');

  // ── 1. Check .env ──
  if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_PATH);
      console.log('  \x1b[33m.env dosyasi .env.example\'dan olusturuldu.\x1b[0m');
      console.log('  \x1b[33mLutfen .env dosyasini duzenleyip Supabase bilgilerinizi girin.\x1b[0m\n');
      process.exit(1);
    } else {
      console.log('  \x1b[31m.env ve .env.example dosyalari bulunamadi!\x1b[0m');
      process.exit(1);
    }
  }

  require('dotenv').config({ path: ENV_PATH });
  log(1, TOTAL, 'Ortam degiskenleri kontrol ediliyor...');

  // ── 2. Validate required env vars ──
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    log(2, TOTAL, 'Zorunlu degiskenler eksik', 'FAIL');
    console.log('\n  Eksik degiskenler:');
    missing.forEach(v => console.log(`    - ${v}`));
    console.log('\n  .env dosyasini duzenleyip bu degiskenleri doldurun.\n');
    process.exit(1);
  }
  log(2, TOTAL, 'Zorunlu degiskenler dogrulandi');

  // ── 3. Test DB connection ──
  const { Client } = require('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query('SELECT 1');
    log(3, TOTAL, 'Veritabani baglantisi test edildi');
  } catch (err) {
    log(3, TOTAL, 'Veritabani baglantisi basarisiz', 'FAIL');
    console.log(`\n  Hata: ${err.message}`);
    console.log('  DATABASE_URL degiskenini kontrol edin.\n');
    process.exit(1);
  } finally {
    await db.end().catch(() => {});
  }

  // ── 4. Prisma generate ──
  try {
    run('npx', ['prisma', 'generate']);
    log(4, TOTAL, 'Prisma client olusturuldu');
  } catch (err) {
    log(4, TOTAL, 'Prisma generate basarisiz', 'FAIL');
    console.log(`\n  ${err.stderr?.toString() || err.message}\n`);
    process.exit(1);
  }

  // ── 5. Prisma db push (schema sync) ──
  try {
    run('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
    log(5, TOTAL, 'Veritabani semasi senkronize edildi');
  } catch (err) {
    log(5, TOTAL, 'Schema sync basarisiz', 'FAIL');
    console.log(`\n  ${err.stderr?.toString() || err.message}\n`);
    process.exit(1);
  }

  // ── 6. Apply RLS ──
  const rlsScript = path.join(ROOT, 'scripts', 'apply-rls.js');
  if (fs.existsSync(rlsScript)) {
    try {
      run('node', [rlsScript]);
      log(6, TOTAL, 'RLS politikalari uygulandi');
    } catch {
      log(6, TOTAL, 'RLS uygulanamadi (devam ediliyor)', 'SKIP');
    }
  } else {
    log(6, TOTAL, 'RLS scripti bulunamadi', 'SKIP');
  }

  // ── 7. Seed demo data ──
  const db2 = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db2.connect();
    const result = await db2.query("SELECT COUNT(*) FROM organizations WHERE code = 'DEMO-001'");
    const exists = parseInt(result.rows[0].count, 10) > 0;

    if (exists) {
      log(7, TOTAL, 'Demo verisi zaten mevcut', 'SKIP');
    } else {
      const seedScript = path.join(ROOT, 'scripts', 'seed-demo.js');
      if (fs.existsSync(seedScript)) {
        try {
          run('node', [seedScript]);
          log(7, TOTAL, 'Demo verisi olusturuldu');
        } catch {
          log(7, TOTAL, 'Demo seed basarisiz (devam ediliyor)', 'SKIP');
        }
      } else {
        log(7, TOTAL, 'Seed scripti bulunamadi', 'SKIP');
      }
    }
  } catch {
    log(7, TOTAL, 'Demo veri kontrolu basarisiz', 'SKIP');
  } finally {
    await db2.end().catch(() => {});
  }

  // ── Final ──
  console.log('\n\x1b[32m\x1b[1m  Setup tamamlandi!\x1b[0m\n');
  console.log('  Baslatmak icin:  \x1b[1mpnpm dev\x1b[0m\n');
  console.log('  Giris bilgileri:');
  console.log('  +--------------+-------------------+--------------+');
  console.log('  | Rol          | E-posta           | Sifre        |');
  console.log('  +--------------+-------------------+--------------+');
  console.log('  | Super Admin  | super@demo.com    | demo123456   |');
  console.log('  | Hastane Admin| admin@demo.com    | demo123456   |');
  console.log('  | Personel     | staff@demo.com    | demo123456   |');
  console.log('  +--------------+-------------------+--------------+\n');
}

setup().catch(err => {
  console.error('\n  \x1b[31mBeklenmeyen hata:\x1b[0m', err.message);
  process.exit(1);
});
