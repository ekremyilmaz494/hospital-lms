import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from '@sentry/nextjs';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const withPWA = withPWAInit({
  dest: "public",
  // Service worker'ı sadece production'da aktif et
  disable: process.env.NODE_ENV === "development",
  // Offline navigasyonda /offline fallback sayfasını göster
  fallbacks: {
    document: "/offline",
  },
  // Push event ve notificationclick için custom worker
  customWorkerSrc: "worker",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // API çağrıları: önce ağ, ağ yoksa cache
      {
        urlPattern: /\/api\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 },
          networkTimeoutSeconds: 10,
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Statik varlıklar: cache ama arka planda güncelle (eski chunk sorunu önlenir)
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-cache",
          expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 },
        },
      },
      // Görseller: önce cache
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: { maxEntries: 60, maxAgeSeconds: 86400 * 7 },
        },
      },
    ],
  },
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
});

const nextConfig: NextConfig = {
  // macOS provenance/file-provider attribute'leri Turbopack SST yazımını engelliyor.
  // .next dizinini /tmp altına taşıyarak bu sorunu önlüyoruz.
  distDir: process.env.NODE_ENV === 'development' ? '/tmp/hospital-lms-next' : '.next',
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
  },
  experimental: {
    proxyClientMaxBodySize: '512mb',
    optimizePackageImports: ['recharts', '@radix-ui/react-icons', 'lucide-react', 'framer-motion', 'date-fns', '@tanstack/react-table', '@tiptap/react'],
  },
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
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.cloudfront.net https://*.sentry.io https://*.ingest.sentry.io",
            "media-src 'self' https://*.cloudfront.net blob:",
            "frame-src 'self' blob:",
            "worker-src 'self'",
            "manifest-src 'self'",
            "frame-ancestors 'none'",
          ].join('; ')
        },
      ],
    },
    {
      // AI Content Studio result endpoint — iframe ile PDF/medya önizleme için
      source: '/api/admin/ai-content-studio/result/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      ],
    },
    {
      source: '/_next/static/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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

export default withSentryConfig(withPWA(nextConfig), {
  silent: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
