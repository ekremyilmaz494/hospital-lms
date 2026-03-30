/// <reference lib="webworker" />
/**
 * Custom Service Worker — Push Notification Handler
 * Bu dosya @ducanh2912/next-pwa tarafından Workbox çıktısına merge edilir.
 * Precaching ve routing stratejileri next.config.ts'de tanımlanmıştır.
 */

declare const self: ServiceWorkerGlobalScope;

/** Web Push bildirimi geldiğinde sistem bildirimi göster */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? 'Hastane LMS';
  const options: NotificationOptions = {
    body:    payload.body ?? '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     'hastane-lms-notification',
    data:    { url: payload.url ?? '/staff/dashboard' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/** Bildirime tıklandığında ilgili sayfaya yönlendir */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl: string =
    (event.notification.data as { url?: string })?.url ?? '/staff/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Açık pencere varsa odaklan ve yönlendir
        for (const client of clientList) {
          if ('focus' in client) {
            void (client as WindowClient).focus();
            void (client as WindowClient).navigate(targetUrl);
            return;
          }
        }
        // Pencere yoksa yeni sekme aç
        if (self.clients.openWindow) {
          void self.clients.openWindow(targetUrl);
        }
      })
  );
});
