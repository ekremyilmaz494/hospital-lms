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

// ── Build-time guard: Yanlış Supabase URL ile production build'i engelle ──
// CI (GitHub Actions) ortamında placeholder URL kullanıldığı için atla.
if (process.env.NODE_ENV === 'production' && !process.env.CI) {
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
    remotePatterns: [
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
    {
      source: '/admin/media-library',
      destination: '/admin/content-library',
      permanent: true,
    },
    {
      source: '/admin/media-library/:path*',
      destination: '/admin/content-library',
      permanent: true,
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
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            // unpkg.com: ffmpeg-core.wasm fetch
            // blob:: three.js GLTFLoader gömülü GLB texture'larını blob URL'den fetch eder
            "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.cloudfront.net https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com https://*.s3-accelerate.amazonaws.com https://*.sentry.io https://*.ingest.sentry.io https://unpkg.com",
            "media-src 'self' data: https://*.cloudfront.net https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com blob:",
            "frame-src 'self' https://*.s3.amazonaws.com https://*.s3.eu-central-1.amazonaws.com blob:",
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

export default process.env.NODE_ENV === 'development'
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
