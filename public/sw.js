// KILL-SWITCH SERVICE WORKER — 2026-05-11
// Bu dosya bir önceki next-pwa kurulumundan kalan stale chunk cache'lerini
// temizlemek için yazıldı. Eski SW kullanıcının tarayıcısında precache'lenmiş
// (redesign öncesi) admin/staff chunk'larını serve ediyordu → admin kullanıcılar
// DevTools açtığında veya network event'i tetiklendiğinde eski staff paneline
// düşüyordu (workbox precache hit + 'staff' role default'una düşen auth parse).
//
// Bu kill-switch:
//  1. Eski SW'i HEMEN devralır (skipWaiting + clientsClaim)
//  2. Tüm Cache Storage girdilerini siler
//  3. Açık tüm sekmeleri mevcut URL'lerine yeniden navigate eder (yeni
//     deployment'tan fresh HTML+chunk fetch ettirir)
//  4. Sonra kendini unregister eder — bir sonraki ziyarette hiç SW olmaz
//
// Cookie / localStorage / IndexedDB'ye DOKUNMAZ → Supabase auth token cookie'de
// olduğu için kullanıcı login'de kalır.

self.addEventListener('install', () => {
  // Waiting fazını atla — eski SW kapanmadan da yeni SW aktive olsun
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Tüm açık sekmelerin kontrolünü hemen al (eski SW'i devre dışı bırak)
      await self.clients.claim();

      // Workbox precache + runtime cache + start-url + api-cache vb. her şeyi sil
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {}

      // Açık sekmeleri tazele — kullanıcı mevcut URL'inde kalır ama fresh fetch yapar
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          try {
            await client.navigate(client.url);
          } catch (_) {}
        }
      } catch (_) {}

      // En sonda kendini unregister et — bu sayfada bir daha SW aktif olmaz
      try {
        await self.registration.unregister();
      } catch (_) {}
    })()
  );
});

// Hiçbir fetch'i intercept etme — ağ tabanlı normal davranış
self.addEventListener('fetch', () => {});
