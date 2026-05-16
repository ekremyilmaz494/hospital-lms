/**
 * fix-nft-manifests.js — Next.js 16 webpack build sonrası NFT manifest düzeltmesi.
 *
 * Sorun: Next.js 16.2.1 "use client" page'ler için page_client-reference-manifest.js
 * referansını NFT dosyasına ekliyor ama dosyayı oluşturmuyor.
 * Vercel deploy sırasında lstat ile kontrol ederken ENOENT hatası veriyor.
 *
 * Çözüm: NFT dosyalarında referans edilen ama var olmayan manifest dosyalarını
 * boş JS modül olarak oluşturur.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const NEXT_DIR = path.resolve(__dirname, '..', '.next');
const SERVER_APP = path.join(NEXT_DIR, 'server', 'app');

if (!fs.existsSync(SERVER_APP)) {
  console.log('[fix-nft] .next/server/app bulunamadı — build çalışmamış olabilir.');
  process.exit(0);
}

let fixed = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.nft.json')) {
      try {
        const nft = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (!nft.files) continue;
        for (const file of nft.files) {
          if (file.includes('client-reference-manifest')) {
            const manifestPath = path.resolve(path.dirname(fullPath), file);
            if (!fs.existsSync(manifestPath)) {
              fs.writeFileSync(manifestPath, 'self.__RSC_MANIFEST={};\n');
              fixed++;
            }
          }
        }
      } catch {
        // NFT parse hatası — atla
      }
    }
  }
}

walkDir(SERVER_APP);

if (fixed > 0) {
  console.log(`[fix-nft] ✓ ${fixed} eksik client-reference-manifest dosyası oluşturuldu.`);
} else {
  console.log('[fix-nft] ✓ Tüm manifest dosyaları mevcut — düzeltme gerekmedi.');
}
