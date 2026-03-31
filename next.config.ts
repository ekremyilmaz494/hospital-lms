import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

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
      // Statik varlıklar: önce cache
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-cache",
          expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 30 },
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
  aggressiveFrontEndNavCaching: true,
});

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
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
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.cloudfront.net",
            "media-src 'self' https://*.cloudfront.net blob:",
            // Service worker ve PWA manifest için
            "worker-src 'self'",
            "manifest-src 'self'",
            "frame-ancestors 'none'",
          ].join('; ')
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

export default withPWA(nextConfig);
