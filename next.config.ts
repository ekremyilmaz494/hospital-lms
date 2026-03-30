import type { NextConfig } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: '512mb',
    optimizePackageImports: ['recharts', '@radix-ui/react-icons', 'lucide-react', 'framer-motion'],
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
            // 'unsafe-eval' is required by Next.js HMR in development only.
            // Remove it in production to block eval-based XSS attacks.
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.cloudfront.net",
            "media-src 'self' https://*.cloudfront.net blob:",
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

export default nextConfig;
