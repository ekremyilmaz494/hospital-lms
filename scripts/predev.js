/**
 * predev.js — pnpm dev öncesi otomatik çalışır.
 * 1. macOS com.apple.provenance attribute temizliği (Turbopack SST hatası önlenir)
 * 2. Prisma client generate
 * 3. DB schema senkronizasyonu
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ── 1. macOS provenance temizliği ──
// com.apple.provenance attribute Turbopack'in SST dosyası yazmasını engelliyor.
// xattr komutuna sabit string path'ler veriyoruz — kullanıcı girdisi yok.
if (os.platform() === 'darwin') {
  try {
    const nextDir = path.join(root, '.next');
    if (fs.existsSync(nextDir)) {
      execFileSync('xattr', ['-d', 'com.apple.provenance', nextDir], { stdio: 'ignore' });
    }
    execFileSync('xattr', ['-d', 'com.apple.provenance', root], { stdio: 'ignore' });
    console.log('[predev] ✓ macOS provenance temizlendi');
  } catch {
    // Attribute yoksa hata verir — sorun değil
  }
}

// ── 2. Prisma generate ──
try {
  console.log('[predev] Prisma client generate ediliyor...');
  execSync('pnpm exec prisma generate', { stdio: 'inherit', cwd: root, timeout: 30000 });
  console.log('[predev] ✓ Prisma client hazır');
} catch (err) {
  console.warn('[predev] ⚠ Prisma generate başarısız:', err.message?.substring(0, 80));
}

// ── 3. DB sync ──
try {
  require('./sync-db.js');
} catch {
  // sync-db kendi hata yönetimini yapar
}
