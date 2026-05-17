/**
 * Dinamik PWA manifest — tenant subdomain'ine göre marka/isim/icon değişir.
 *
 * - `devakent.<base>` → "Devakent Hastanesi" + devakent-logo (mevcut PWA install
 *   davranışı korunur; Devakent'in özel manifest'i [[tenants-devakent]] paketine
 *   taşınacak Faz 2'de)
 * - Diğer subdomain'ler / root domain → `BRAND.fullName` (sektör-agnostik)
 *
 * Eski `public/manifest.json` artık fallback; App Router bu route'u öncelikle servis eder.
 */
import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { BRAND } from '@/lib/brand'
import { extractSubdomain } from '@/lib/organization-utils'

type TenantPreset = {
  name: string
  shortName: string
  icon: string
}

// Tenant-spesifik override'lar. İleride DB'den okunabilir; şu an Devakent için
// statik. Yeni tenant eklendikçe buraya satır eklenir veya Faz 2'de
// @tenants/<slug> paketlerine taşınır.
const TENANT_OVERRIDES: Record<string, TenantPreset> = {
  devakent: {
    name: 'Devakent Hastanesi',
    shortName: 'Devakent',
    icon: '/devakent-logo.svg',
  },
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? ''
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? BRAND.domain
  const subdomain = extractSubdomain(host, baseDomain)
  const preset = subdomain ? TENANT_OVERRIDES[subdomain] : undefined

  const name = preset?.name ?? BRAND.fullName
  const shortName = preset?.shortName ?? BRAND.name
  const iconSrc = preset?.icon ?? '/apple-touch-icon.png'

  return {
    name,
    short_name: shortName,
    description: BRAND.shortDesc,
    theme_color: '#0d9668',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/staff/dashboard',
    icons: [
      {
        src: iconSrc,
        sizes: 'any',
        type: iconSrc.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'any',
      },
    ],
  }
}
