import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Returns the application URL. In production, NEXT_PUBLIC_APP_URL must be set
 * explicitly — falling back to localhost would be a security misconfiguration.
 */
function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url && isProduction) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is required in production. ' +
      'Set it to your canonical domain (e.g. https://lms.example.com).'
    );
  }
  return url || 'http://localhost:3000';
}

const appUrl = getAppUrl();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
const supabaseDomain = supabaseUrl.startsWith('https://')
  ? supabaseUrl
  : `https://${supabaseUrl}`;

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: '512mb',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
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
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // TODO: Remove 'unsafe-inline' from script-src once nonce-based CSP is implemented.
            // Next.js currently requires 'unsafe-inline' for hydration inline scripts.
            `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
            "style-src 'self' 'unsafe-inline'",
            `img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net`,
            "font-src 'self' data:",
            `connect-src 'self' ${supabaseDomain} wss://*.supabase.co https://*.cloudfront.net`,
            "media-src 'self' https://*.cloudfront.net blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ')
        },
      ],
    },
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: appUrl },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ],
};

export default nextConfig;
