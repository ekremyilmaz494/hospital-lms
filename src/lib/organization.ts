import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'

// Pure utility'ler ayrı dosyada — middleware (Edge Runtime) güvenle import edebilsin
export { extractSubdomain, slugify } from '@/lib/organization-utils'

const ORG_SLUG_CACHE_PREFIX = 'org:slug:'
const ORG_DOMAIN_CACHE_PREFIX = 'org:domain:'
const ORG_CACHE_TTL = 3600 // 1 saat

/** Organizasyon bilgisi (slug/domain lookup sonucu) */
export interface OrganizationInfo {
  id: string
  name: string
  logoUrl: string | null
  brandColor: string
}

/**
 * Slug ile organizasyon bilgisi getirir. Redis cache (1 saat TTL).
 * Bulunamazsa null döner.
 */
export async function getOrganizationBySlug(slug: string): Promise<OrganizationInfo | null> {
  if (!slug) return null

  const cacheKey = `${ORG_SLUG_CACHE_PREFIX}${slug}`

  // Önce cache'e bak
  const cached = await getCached<OrganizationInfo>(cacheKey)
  if (cached) return cached

  // DB'den çek
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug },
        { code: slug },
      ],
      isActive: true,
      isSuspended: false,
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      brandColor: true,
    },
  })

  if (!org) return null

  const result: OrganizationInfo = {
    id: org.id,
    name: org.name,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
  }

  // Cache'e yaz
  await setCached(cacheKey, result, ORG_CACHE_TTL)

  return result
}

/**
 * Custom domain ile organizasyon bilgisi getirir. Redis cache (1 saat TTL).
 */
export async function getOrganizationByDomain(domain: string): Promise<OrganizationInfo | null> {
  if (!domain) return null

  const cacheKey = `${ORG_DOMAIN_CACHE_PREFIX}${domain}`

  const cached = await getCached<OrganizationInfo>(cacheKey)
  if (cached) return cached

  const org = await prisma.organization.findUnique({
    where: {
      customDomain: domain,
      isActive: true,
      isSuspended: false,
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      brandColor: true,
    },
  })

  if (!org) return null

  const result: OrganizationInfo = {
    id: org.id,
    name: org.name,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
  }

  await setCached(cacheKey, result, ORG_CACHE_TTL)

  return result
}

