#!/usr/bin/env node
/**
 * Environment Variable Validator
 * Yanlış Supabase/Vercel env yapılandırmasını deploy öncesi yakalar.
 *
 * Kullanım: node scripts/validate-env.js
 * CI/CD:    package.json → "predeploy": "node scripts/validate-env.js"
 */

const { URL } = require('node:url');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

// ── Config ──
const EXPECTED_REF = 'pkkkyyajfmusurcoovwt';
const EXPECTED_REGION = 'eu-central-1';

// ── .env parser (dotenv bağımlılığı olmadan) ──
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

// .env dosyalarını yükle (process.env override etmez, CI'da process.env öncelikli)
const rootDir = resolve(__dirname, '..');
const envDefault = parseEnvFile(resolve(rootDir, '.env'));
const envLocal = parseEnvFile(resolve(rootDir, '.env.local'));
const env = { ...envDefault, ...envLocal, ...process.env };

// ── Helpers ──
const errors = [];
const warnings = [];
let checks = 0;

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function pass() { checks++; }

function extractRef(supabaseUrl) {
  try {
    const host = new URL(supabaseUrl).hostname; // pkkkyyajfmusurcoovwt.supabase.co
    return host.split('.')[0];
  } catch {
    return null;
  }
}

function extractRefFromDbUrl(dbUrl) {
  try {
    const host = new URL(dbUrl).hostname;
    // postgres.pkkkyyajfmusurcoovwt.supabase.co → pkkkyyajfmusurcoovwt
    // db.pkkkyyajfmusurcoovwt.supabase.co → pkkkyyajfmusurcoovwt
    // aws-0-eu-central-1.pooler.supabase.com → parse from user/path
    if (host.endsWith('.supabase.co')) {
      const parts = host.split('.');
      // postgres.<ref>.supabase.co or db.<ref>.supabase.co
      if (parts.length === 4) return parts[1];
      if (parts.length === 3) return parts[0];
    }
    // Pooler format: user part contains ref
    const u = new URL(dbUrl);
    const user = u.username; // postgres.pkkkyyajfmusurcoovwt
    if (user && user.includes('.')) {
      return user.split('.')[1];
    }
    return null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════
// KONTROL 1 — Zorunlu env var varlığı
// ══════════════════════════════════════════════
// Her ortamda zorunlu
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
];

// Sadece production'da zorunlu (lokalde opsiyonel)
const PROD_ONLY_VARS = [
  'REDIS_URL',
  'REDIS_TOKEN',
  'CRON_SECRET',
  'BACKUP_ENCRYPTION_KEY',
  'ENCRYPTION_KEY',
  'HEALTH_CHECK_SECRET',
];

const PLACEHOLDER_PATTERNS = ['your-', 'generate-a-', 'xxx', 'CHANGE_ME', 'placeholder'];
const isProduction = env.NODE_ENV === 'production';

for (const varName of REQUIRED_VARS) {
  const val = env[varName];
  if (!val || val.trim() === '') {
    fail(`[ENV] ${varName} tanımlı değil veya boş`);
  } else if (PLACEHOLDER_PATTERNS.some(p => val.toLowerCase().includes(p))) {
    fail(`[ENV] ${varName} placeholder değer içeriyor: "${val.slice(0, 30)}..."`);
  } else {
    pass();
  }
}

// Production-only kontroller
if (isProduction) {
  for (const varName of PROD_ONLY_VARS) {
    const val = env[varName];
    if (!val || val.trim() === '') {
      fail(`[ENV] ${varName} production'da zorunlu ama tanımlı değil`);
    } else {
      pass();
    }
  }
} else {
  for (const varName of PROD_ONLY_VARS) {
    if (!env[varName]) {
      warn(`[ENV] ${varName} tanımlı değil (development'ta opsiyonel, production'da zorunlu)`);
    } else {
      pass();
    }
  }
}

// ══════════════════════════════════════════════
// KONTROL 2 — Supabase project ref tutarlılığı
// ══════════════════════════════════════════════
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = env.DATABASE_URL;
const directUrl = env.DIRECT_URL;

if (supabaseUrl) {
  const urlRef = extractRef(supabaseUrl);

  // 2a) Hardcoded beklenen ref
  if (urlRef !== EXPECTED_REF) {
    fail(`[REF] NEXT_PUBLIC_SUPABASE_URL yanlış projeye işaret ediyor!\n` +
         `       Beklenen ref: ${EXPECTED_REF}\n` +
         `       Bulunan ref:  ${urlRef}\n` +
         `       URL: ${supabaseUrl}\n` +
         `       → Supabase Seoul→Frankfurt taşınmış olabilir, URL güncellenmeli!`);
  } else {
    pass();
  }

  // 2b) DATABASE_URL ref karşılaştırması
  if (databaseUrl) {
    const dbRef = extractRefFromDbUrl(databaseUrl);
    if (dbRef && dbRef !== urlRef) {
      fail(`[REF] DATABASE_URL farklı Supabase projesine işaret ediyor!\n` +
           `       SUPABASE_URL ref: ${urlRef}\n` +
           `       DATABASE_URL ref: ${dbRef}\n` +
           `       → Tüm URL'ler aynı projeyi göstermeli!`);
    } else if (dbRef) {
      pass();
    }
  }

  // 2c) DIRECT_URL ref karşılaştırması
  if (directUrl) {
    const directRef = extractRefFromDbUrl(directUrl);
    if (directRef && directRef !== urlRef) {
      fail(`[REF] DIRECT_URL farklı Supabase projesine işaret ediyor!\n` +
           `       SUPABASE_URL ref: ${urlRef}\n` +
           `       DIRECT_URL ref:   ${directRef}`);
    } else if (directRef) {
      pass();
    }
  }
}

// ══════════════════════════════════════════════
// KONTROL 3 — Region doğrulaması
// ══════════════════════════════════════════════
if (databaseUrl) {
  if (!databaseUrl.includes(EXPECTED_REGION)) {
    const detected = databaseUrl.match(/([a-z]{2}-[a-z]+-\d)/)?.[1] ?? 'bilinmiyor';
    warn(`[REGION] DATABASE_URL'de "${EXPECTED_REGION}" (Frankfurt) bulunamadı.\n` +
         `         Tespit edilen bölge: ${detected}\n` +
         `         → Seoul (ap-northeast-2) veya başka bölge olabilir!`);
  } else {
    pass();
  }
}

// ══════════════════════════════════════════════
// KONTROL 4 — Production'da localhost kontrolü
// ══════════════════════════════════════════════
const appUrl = env.NEXT_PUBLIC_APP_URL;

if (isProduction && appUrl && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
  fail(`[URL] NEXT_PUBLIC_APP_URL production'da localhost olamaz!\n` +
       `       Değer: ${appUrl}\n` +
       `       → Vercel deployment URL'ini ayarlayın`);
} else if (appUrl) {
  pass();
}

// ══════════════════════════════════════════════
// SONUÇ
// ══════════════════════════════════════════════
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║       ENV VALIDATION REPORT                  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');

if (errors.length > 0) {
  console.log('\x1b[31m✗ HATALAR (%d):\x1b[0m', errors.length);
  errors.forEach((e, i) => console.log('\x1b[31m  %d. %s\x1b[0m', i + 1, e));
  console.log('');
}

if (warnings.length > 0) {
  console.log('\x1b[33m⚠ UYARILAR (%d):\x1b[0m', warnings.length);
  warnings.forEach((w, i) => console.log('\x1b[33m  %d. %s\x1b[0m', i + 1, w));
  console.log('');
}

if (errors.length === 0) {
  const ref = extractRef(supabaseUrl) ?? '?';
  console.log('\x1b[32m✅ Tüm %d kontrol geçti — production\'a deploy güvenli\x1b[0m', checks);
  console.log('\x1b[32m✅ Supabase project: %s (Frankfurt %s)\x1b[0m', ref, EXPECTED_REGION);
  console.log('\x1b[32m✅ DB URL ref eşleşti\x1b[0m');
  if (warnings.length > 0) {
    console.log('\x1b[33m⚠  %d uyarı var — yukarıya bakın\x1b[0m', warnings.length);
  }
  console.log('');
  process.exit(0);
} else {
  console.log('\x1b[31m✗ %d hata bulundu — deploy YAPILAMAZ!\x1b[0m', errors.length);
  console.log('\x1b[31m  Hataları düzeltin ve tekrar çalıştırın: node scripts/validate-env.js\x1b[0m');
  console.log('');
  process.exit(1);
}
