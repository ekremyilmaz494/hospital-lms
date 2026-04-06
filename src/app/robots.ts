import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hastane-lms.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/demo', '/contact', '/kvkk'],
        disallow: [
          '/admin/',
          '/super-admin/',
          '/staff/',
          '/exam/',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
