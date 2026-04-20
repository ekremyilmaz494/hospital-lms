/**
 * predev.js — pnpm dev öncesi otomatik çalışır.
 * 1. macOS com.apple.provenance attribute temizliği (Turbopack SST hatası önlenir)
 * 2. Prisma client generate
 * 3. DB schema senkronizasyonu
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync, execFileSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ── 1. macOS iCloud + provenance temizliği ──
// com.apple.provenance attribute Turbopack'in SST dosyası yazmasını engelliyor.
// Desktop iCloud Drive sync aktifse .next klasörü yanında ".next 2" conflict copy
// oluşuyor — bunları siliyoruz. Dev build .next.nosync'e yazıldığı için
// (next.config.ts dev+darwin koşulu) iCloud sync'i bypass ediyoruz; bu adım
// legacy .next artefaktlarını temizliyor.
if (os.platform() === 'darwin') {
  // Provenance temizliği — her iki distDir adı + proje root
  const provenanceTargets = [
    path.join(root, '.next'),
    path.join(root, '.next.nosync'),
    root,
  ];
  for (const target of provenanceTargets) {
    if (fs.existsSync(target)) {
      try { execFileSync('xattr', ['-d', 'com.apple.provenance', target], { stdio: 'ignore' }); } catch {}
    }
  }
  // iCloud conflict copy cleanup (0 byte ".next 2" tipi artefaktlar)
  for (const name of ['.next 2', '.next.nosync 2']) {
    const full = path.join(root, name);
    if (fs.existsSync(full)) {
      try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
    }
  }
  console.log('[predev] ✓ macOS provenance + iCloud artefakt temizliği');
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
