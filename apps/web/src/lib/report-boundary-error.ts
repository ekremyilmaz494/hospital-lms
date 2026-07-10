import * as Sentry from '@sentry/nextjs'

/**
 * Error-boundary raporlama — TÜM error.tsx / global-error.tsx boundary'lerinden çağrılır.
 *
 * İki kanal:
 *  1. Sentry.captureException — bulut (Vercel) gözlemlenebilirliği.
 *  2. POST /api/telemetry/client-error — air-gap on-prem görünürlüğü: Sentry DSN yoksa
 *     captureException no-op olur; bu POST hatayı sunucu stdout'una (`docker logs app`) düşürür.
 *
 * NEDEN paylaşılan helper: Next.js EN YAKIN error boundary'yi kullanır. Repoda ~59 error.tsx
 * var; raporlama yalnız kök 2 dosyaya gömülü olsaydı /admin, /staff, /exam gibi iç segmentlerin
 * çöküşleri kendi (raporlamasız) boundary'lerinde yakalanır ve HİÇBİR yere düşmezdi. Tek helper'ı
 * tüm boundary'lerden çağırarak kapsama tamamlanır.
 *
 * Alanlar GÖNDERMEDEN ÖNCE kısaltılır → gövde ~2.5KB'ı geçmez. Böylece uzun Next.js stack'leri /
 * hydration hataları route'un 4KB gövde kapısına takılıp SESSİZCE düşmez (aksi halde en gürültülü
 * çöküşler tam da kaybolurdu). Best-effort: her iki kanal da sessizce yutulur (zaten hata ekranı).
 */
export function reportBoundaryError(error: (Error & { digest?: string }) | undefined): void {
  try {
    if (error) Sentry.captureException(error)
  } catch {
    // Sentry yüklen/başlatılamazsa yut — telemetri best-effort.
  }
  try {
    const body = JSON.stringify({
      message: (error?.message ?? String(error ?? 'unknown')).slice(0, 500),
      digest: error?.digest ? String(error.digest).slice(0, 200) : undefined,
      stack: error?.stack ? String(error.stack).slice(0, 2000) : undefined,
      url: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : undefined,
    })
    void fetch('/api/telemetry/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body,
    }).catch(() => {})
  } catch {
    // JSON/fetch kurulum hatasını yut — asla boundary'ye geri sızmasın.
  }
}
