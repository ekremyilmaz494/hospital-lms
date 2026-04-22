'use client';

import { useEffect } from 'react';

/**
 * Dev-only service worker cleaner.
 *
 * next-pwa dev'de SW register etmez ama `public/sw.js` repo'da commit olduğu
 * için (önceki prod build artefaktı), tarayıcı bir önceki ziyarette register
 * ettiyse hâlâ eski cache chunks'ı serve ediyor → "değişiklik yaptım ama
 * tarayıcıda hâlâ eski arayüz" semptomu.
 *
 * Bu component sadece development'ta mount olur ve her sayfa açılışında
 * mevcut SW registration'larını kaldırır + caches API'sindeki tüm cache'leri
 * siler. Tek seferlik, sessiz, dev DX fix.
 *
 * Production'da render olmaz (layout'ta NODE_ENV gate'i var).
 */
export function DevSWCleaner() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister()));
            // eslint-disable-next-line no-console
            console.info(`[dev] ${regs.length} service worker unregistered`);
          }
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map((k) => caches.delete(k)));
            // eslint-disable-next-line no-console
            console.info(`[dev] ${keys.length} cache keys cleared`);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[dev] SW/cache cleanup failed:', err);
      }
    })();
  }, []);

  return null;
}
