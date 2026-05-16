/**
 * /clear-cache — Müşteri desteği için cache+SW temizleme yardımcı sayfası.
 *
 * Kullanım: Bir kullanıcı stale UI veya yanlış panele atılma şikayeti
 * yaşıyorsa destek temsilcisi bu URL'e gitmesini söyler. Eski next-pwa
 * service worker'ları kalıcıdır — manuel temizleme olmadan kullanıcı tarayıcısı
 * eski chunk'ları serve etmeye devam edebilir.
 *
 * /dev-reset'ten farkı: Bu route kullanıcıyı login'de TUTAR (cookie'lere
 * dokunmaz). Sadece service worker'ları unregister eder ve Cache Storage'ı
 * temizler. Sonunda kullanıcı son rolünün dashboard'ına yönlendirilir.
 *
 * PUBLIC_ROUTES'a ekli — auth gerektirmez (kullanıcı zaten login olduğu için
 * cookie ile gelir, middleware başka bir şeye dokunmaz).
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Önbellek temizleniyor — Klinova</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#fafaf9;color:#1c1917;min-height:100vh;display:grid;place-items:center;padding:24px}
    .card{max-width:480px;background:white;border:1px solid #e7e5e4;border-radius:16px;padding:28px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
    h1{font-size:20px;margin:0 0 12px;font-weight:600}
    p{margin:8px 0;color:#57534e}
    .status{margin-top:16px;padding:12px;background:#f5f5f4;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px;color:#44403c;min-height:48px}
    .done{background:#dcfce7;color:#166534}
    .err{background:#fee2e2;color:#991b1b}
    a{color:#0d9668;font-weight:500;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <h1>Önbellek temizleniyor</h1>
    <p>Eski tarayıcı verisi temizleniyor. Bu işlem oturumunuzu sonlandırmaz; birkaç saniye sürer.</p>
    <div class="status" id="status">Başlatılıyor...</div>
    <p style="margin-top:16px;font-size:14px">Sayfa otomatik yönlendirilmezse <a href="/">ana sayfaya tıklayın</a>.</p>
  </div>
<script>
(async () => {
  const status = document.getElementById('status');
  const log = (msg) => { status.textContent = msg; };
  const ok = () => { status.classList.add('done'); };
  const fail = (msg) => { status.classList.add('err'); status.textContent = 'Hata: ' + msg; };

  try {
    let swCount = 0;
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        try { await r.unregister(); swCount++; } catch (_) {}
      }
      log(swCount + ' service worker kaldırıldı.');
    }

    let cacheCount = 0;
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        try { await caches.delete(k); cacheCount++; } catch (_) {}
      }
      log(swCount + ' service worker + ' + cacheCount + ' önbellek temizlendi.');
    }

    ok();
    log('Tamamlandı. Yönlendiriliyorsunuz...');
    // Tam sayfa yenileme — yeni HTML+chunk'ları fresh fetch et
    setTimeout(() => { window.location.replace('/'); }, 1200);
  } catch (e) {
    fail((e && e.message) || 'bilinmeyen hata');
  }
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
