import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import { withSentryConfig } from '@sentry/nextjs';
import path from 'node:path';

// Monorepo root (apps/web'in iki üstü). Turbopack workspace boundary'sini ve
// outputFileTracingRoot'u burası belirler. pnpm workspaces'te node_modules/.pnpm
// monorepo köküne yazılır; turbopack.root apps/web olursa symlink'lenmiş paketler
// "dışarıda" sayılıp `next/package.json` resolve edilemez (Vercel build hatası).
// Local dev'de pnpm --filter web dev CWD'yi apps/web yapar → '..' '..' = repo root.
// Eski not (Desktop/deva-project parent issue): artık geçerli değil çünkü apps/web
// gerçek bir monorepo içinde, parent'ta legit pnpm-workspace.yaml var.
const projectRoot = path.resolve('..', '..');

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── Dağıtım modu ──
// On-prem imaj build'i NEXT_PUBLIC_DEPLOYMENT_MODE=onprem ile yapılır (bundle'a
// gömülür — runtime'da değiştirilemez; bkz. src/lib/deployment.ts). Bayrak yokken
// tüm davranış bulut (mevcut) davranışıyla birebir aynıdır.
const isOnPremBuild =
  process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'onprem' ||
  process.env.DEPLOYMENT_MODE === 'onprem';

// On-prem CSP/images için env'den türetilen origin'ler. NEXT_PUBLIC_STORAGE_HOST =
// tarayıcının eriştiği nesne deposu origin'i (örn. MinIO: https://depo.hastane.local).
const storageOrigin = (process.env.NEXT_PUBLIC_STORAGE_HOST ?? '').replace(/\/$/, '');
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();
// Realtime websocket aynı host'a ws(s) şemasıyla bağlanır.
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws');
const cspList = (parts: Array<string | false>) => parts.filter(Boolean).join(' ');

// ── Build-time guard: Yanlış Supabase URL ile production build'i engelle ──
// CI (GitHub Actions) ortamında placeholder URL kullanıldığı için atla.
// On-prem build'ler müşteriye özel (self-hosted) Supabase kullanır — guard anlamsız.
if (process.env.NODE_ENV === 'production' && !process.env.CI && !isOnPremBuild) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const expectedRef = 'pkkkyyajfmusurcoovwt';
  if (!supabaseUrl.includes(expectedRef)) {
    throw new Error(
      `\n\n🚨 NEXT_PUBLIC_SUPABASE_URL yanlış Supabase projesine işaret ediyor!\n` +
        `   Beklenen ref: ${expectedRef} (Frankfurt eu-central-1)\n` +
        `   Mevcut URL:   ${supabaseUrl || '(boş)'}\n` +
        `   → Vercel Environment Variables'ı kontrol edin.\n` +
        `   → Doğru URL: https://${expectedRef}.supabase.co\n\n`
    );
  }
}

// ⚠️ 2026-05-11 — PWA tamamen DEVRE DIŞI
// Geçmiş prod build'in service worker'ı stale chunk'lar serve ediyordu →
// admin kullanıcılar redesign-öncesi staff paneline düşüyordu. public/sw.js
// kill-switch SW ile değiştirildi (eski cache'leri temizleyip kendini unregister
// eden minimal SW). next-pwa wrapper'ını `disable: true` yaparak build'in bu
// dosyayı overwrite etmesini engelliyoruz. Wrapper'ı tamamen sökme + paket
// kaldırma sonraki temizlik PR'ında yapılacak.
const withPWA = withPWAInit({
  dest: 'public',
  disable: true,
});

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // On-prem Docker imajı self-contained çalışmalı: standalone output,
  // .next/standalone altına yalnız gereken dosyaları (traced) kopyalar.
  // Bulut (Vercel) build'inde output ayarlanmaz — Vercel kendi çıktısını yönetir.
  ...(isOnPremBuild ? { output: 'standalone' as const } : {}),
  serverExternalPackages: ['remotion', '@remotion/cli'],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  // macOS iCloud Drive, .nosync suffix'li klasörleri senkronize etmez (Apple dokümante).
  // Dev+darwin'de distDir'i .next.nosync yapıp iCloud eviction'ı engelliyoruz.
  // Vercel (Linux + prod) ve CI koşulu geçer, klasik .next kullanılır.
  // NEXT_DIST_DIR env override'ı isteğe bağlı (ör. RAM disk testi için).
  distDir:
    process.env.NEXT_DIST_DIR ??
    (process.env.NODE_ENV === 'development' && process.platform === 'darwin'
      ? '.next.nosync'
      : '.next'),
  images: {
    // On-prem: origin'ler müşteri env'inden türetilir (self-hosted Supabase + MinIO).
    // Bulut: mevcut wildcard'lar aynen korunur.
    remotePatterns: isOnPremBuild
      ? ([supabaseOrigin, storageOrigin]
          .filter(Boolean)
          .map((origin) => {
            const u = new URL(origin);
            return {
              protocol: u.protocol.replace(':', '') as 'http' | 'https',
              hostname: u.hostname,
              ...(u.port ? { port: u.port } : {}),
            };
          }))
      : [
          { protocol: 'https', hostname: '**.supabase.co' },
          { protocol: 'https', hostname: '**.cloudfront.net' },
        ],
  },
  experimental: {
    proxyClientMaxBodySize: '512mb',
    optimizePackageImports: [
      'recharts',
      '@radix-ui/react-icons',
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@tanstack/react-table',
      '@tiptap/react',
      'react-pdf',
      'gsap',
      '@gsap/react',
      'lenis',
    ],
    // View Transitions API — landing ↔ login arasında smooth crossfade.
    // Desteklenmeyen tarayıcılarda (eski Safari) browser default navigation'a düşer.
    viewTransition: true,
    // Windows dev: Türkçe/boşluklu path + Defender real-time scan + uzun HMR oturumu
    // Turbopack'in disk cache'inde yarım CSS chunk yazıyor → Tailwind utility'leri
    // render edilmiyor, sayfa stilsiz kalıyor. RAM-only mod ile bu sınıf bug'ı kökten kapatıyoruz.
    // Maliyet: ilk derleme her dev start'ta sıfırdan; HMR aynı hız.
    ...(process.platform === 'win32' && process.env.NODE_ENV === 'development'
      ? { turbopackFileSystemCacheForDev: false }
      : {}),
  },
  redirects: async () => [
    // Medya Kütüphanesi yeniden kurulduğunda (#209) eski "İçerik Kütüphanesi"
    // route'u (/admin/content-library) kaldırıldı ve sayfa /admin/media-library'ye
    // taşındı. Eski bookmark/SEO için yönlendirme.
    // ⚠️ PROD INCIDENT (2026-06-28): Bu iki kural TERS yazılmıştı
    // (media-library → content-library) → yeni çalışan sayfa, silinmiş eski route'a
    // KALICI (308) yönlendiriliyor, sonra 404 üretiyordu. Hard refresh/cache temizliği
    // çözmüyordu çünkü yönlendirme sunucu tarafındaydı. Yön düzeltildi (eski → yeni).
    //
    // permanent:false (307) + hedef sorgu paramı (?from=cl) BİLİNÇLİDİR: bazı
    // tarayıcılar eski TERS 308'i (media-library → content-library) kalıcı
    // cache'lemiş olabilir. Hedefi farklı bir cache key'e (?from=cl) düşürmek,
    // media-library bare-path'inin bayat 308'iyle sonsuz döngü oluşmasını engeller;
    // bayat tarayıcı bile tek atlamada doğru sayfaya iner. 307 ise bu kuralın
    // kendisinin kalıcı cache'lenmesini önler (geçiş bittiğinde temizlenebilir).
    {
      source: '/admin/content-library',
      destination: '/admin/media-library?from=cl',
      permanent: false,
    },
    {
      source: '/admin/content-library/:path*',
      destination: '/admin/media-library?from=cl',
      permanent: false,
    },
    // Eski /marketing/* URL'leri root marketing route group'una taşındı.
    // Eski bookmark/SEO için 301 redirect.
    { source: '/marketing', destination: '/', permanent: true },
    { source: '/marketing/:path*', destination: '/:path*', permanent: true },
    // Ek hak talepleri sınav değil, eğitim assignment life-cycle'ına ait.
    {
      source: '/admin/exams/attempt-requests',
      destination: '/admin/trainings/attempt-requests',
      permanent: true,
    },
    // Sektör-agnostik refactor (Faz 1): super-admin altındaki "hospitals"
    // route'u "organizations"a taşındı. Eski bookmark/API client'lar için 308.
    {
      source: '/super-admin/hospitals',
      destination: '/super-admin/organizations',
      permanent: true,
    },
    {
      source: '/super-admin/hospitals/:path*',
      destination: '/super-admin/organizations/:path*',
      permanent: true,
    },
    {
      source: '/api/super-admin/hospitals',
      destination: '/api/super-admin/organizations',
      permanent: true,
    },
    {
      source: '/api/super-admin/hospitals/:path*',
      destination: '/api/super-admin/organizations/:path*',
      permanent: true,
    },
  ],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // unpkg.com: ffmpeg-core.js (client-side video compress). 'wasm-unsafe-eval': WebAssembly icin gerekli.
            `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline'",
            // On-prem'de LAN/http senaryosu için storage origin'i açıkça eklenir
            // (https: genel izni http origin'i kapsamaz).
            isOnPremBuild
              ? cspList(["img-src 'self' data: https: blob:", storageOrigin])
              : "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            // unpkg.com: ffmpeg-core.wasm fetch
            // blob:: three.js GLTFLoader gömülü GLB texture'larını blob URL'den fetch eder
            // Sentry: *.ingest.de.sentry.io = AB (Frankfurt) bölgesi ingest — KVKK yurt dışı
            // aktarımını en aza indirmek için AB-bölgesi DSN kullanılır (bkz. .env.production.reference).
            // On-prem: origin'ler env'den (self-hosted Supabase + MinIO); Sentry/CloudFront yok.
            isOnPremBuild
              ? cspList([
                  "connect-src 'self' blob:",
                  supabaseOrigin,
                  supabaseWsOrigin,
                  storageOrigin,
                  'https://unpkg.com',
                ])
              : "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.cloudfront.net https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com https://*.s3-accelerate.amazonaws.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://unpkg.com",
            isOnPremBuild
              ? cspList(["media-src 'self' data:", storageOrigin, 'blob:'])
              : "media-src 'self' data: https://*.cloudfront.net https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com blob:",
            isOnPremBuild
              ? cspList(["frame-src 'self'", storageOrigin, 'blob:'])
              : "frame-src 'self' https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com blob:",
            // blob:: ffmpeg.wasm internal worker'i blob URL'den olusturuyor
            "worker-src 'self' blob:",
            "manifest-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
    {
      source: '/_next/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          // Turbopack dev chunk adları path-stable (hash'siz). Prod'da hash'li
          // olduğu için immutable güvenli; dev'de immutable, kod değişince
          // tarayıcının eski chunk'ı tutup "module factory not available"
          // hatası vermesine yol açıyor → dev'de revalidate zorunlu.
          value:
            process.env.NODE_ENV === 'development'
              ? 'no-store, must-revalidate'
              : 'public, max-age=31536000, immutable',
        },
      ],
    },
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: appUrl },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    },
  ],
};

const finalConfig = withPWA(nextConfig);

// Sentry webpack wrapper dev mode'da `reactComponentAnnotation` babel transform'u
// uzerinden her React component'e source-location enjekte eder; buyuk client
// component'lerde (1000+ satir) her compile'da ussel yavaslamaya yol acar.
// Prod build'de de her component'i sarmalamak hydrate suresini ve bundle'i sisirir;
// SENTRY_REACT_ANNOTATION=1 ile sadece staging'de acik tutulabilir.
const sentryAnnotationEnabled = process.env.SENTRY_REACT_ANNOTATION === '1';

// On-prem build'de Sentry wrapper'ı atlanır: müşteri sunucusunda Sentry hesabı/
// token'ı yoktur; wrapper source-map upload denemesi yapar ve DSN'siz gereksizdir.
export default process.env.NODE_ENV === 'development' || isOnPremBuild
  ? finalConfig
  : withSentryConfig(finalConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      reactComponentAnnotation: { enabled: sentryAnnotationEnabled },
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      automaticVercelMonitors: false,
      disableLogger: true,
    });
