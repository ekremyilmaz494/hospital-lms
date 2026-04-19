export async function GET() {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Cache temizlendi</title>
<meta http-equiv="refresh" content="5;url=/auth/login">
</head>
<body style="font:16px system-ui;padding:40px">
<h2>Cache temizlendi</h2>
<p id="status">Service worker ve cache'ler siliniyor...</p>
<p>5 saniye sonra giris sayfasina yonlendiriliyorsunuz. Olmazsa <a href="/auth/login">buraya tiklayin</a>.</p>
<script>
(async () => {
  const status = document.getElementById('status')
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) await r.unregister()
      status.innerText = regs.length + ' service worker kaldirildi.'
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      for (const k of keys) await caches.delete(k)
    }
    localStorage.clear()
    sessionStorage.clear()
    status.innerText += ' Temiz. Yonlendiriliyor...'
    setTimeout(() => { location.replace('/auth/login') }, 1500)
  } catch (e) {
    status.innerText = 'Hata: ' + e.message
  }
})()
</script>
</body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Clear-Site-Data': '"cache", "cookies", "storage"',
        'Cache-Control': 'no-store',
      },
    }
  )
}
