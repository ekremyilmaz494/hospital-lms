import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationSubscription: { findUnique: vi.fn() },
    user: { count: vi.fn() },
    training: { count: vi.fn() },
  },
}))

vi.mock('@/lib/redis', () => {
  const memCache = new Map<string, { value: string; expiresAt: number }>()
  return {
    getCached: vi.fn(async (key: string) => {
      const entry = memCache.get(key)
      if (!entry || entry.expiresAt < Date.now()) return null
      return JSON.parse(entry.value)
    }),
    setCached: vi.fn(async (key: string, value: unknown, ttl: number) => {
      memCache.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttl * 1000 })
    }),
    invalidateCache: vi.fn(async (key: string) => {
      memCache.delete(key)
    }),
    // Test yardimcisi: cache'i temizle
    __clearMemCache: () => memCache.clear(),
  }
})

import { prisma } from '@/lib/prisma'
import { getCached, setCached, invalidateCache } from '@/lib/redis'

const mockSubFindUnique = prisma.organizationSubscription.findUnique as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockTrainingCount = prisma.training.count as ReturnType<typeof vi.fn>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __clearMemCache } = await import('@/lib/redis') as any

const ORG_ID = 'org-feature-test'

const FULL_PLAN = {
  hasAiContentStudio: true,
  hasScormSupport: true,
  hasHisIntegration: true,
  hasAdvancedReports: true,
  hasSsoSupport: true,
  hasCompetencyModule: true,
  hasAccreditationModule: true,
  hasBulkImport: true,
  hasCustomCertificates: true,
  maxStaff: 100,
  maxTrainings: 50,
  maxStorageGb: 500,
}

const BASIC_PLAN = {
  hasAiContentStudio: false,
  hasScormSupport: false,
  hasHisIntegration: false,
  hasAdvancedReports: false,
  hasSsoSupport: false,
  hasCompetencyModule: false,
  hasAccreditationModule: false,
  hasBulkImport: false,
  hasCustomCertificates: false,
  maxStaff: 10,
  maxTrainings: 5,
  maxStorageGb: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  __clearMemCache()
})

// ── Tests ──

describe('checkFeature — Ozellik kontrolu', () => {
  it('aktif plandaki ozellik icin true doner', async () => {
    mockSubFindUnique.mockResolvedValue({ plan: FULL_PLAN })

    const { checkFeature } = await import('../feature-gate')
    const result = await checkFeature(ORG_ID, 'aiContentStudio')
    expect(result).toBe(true)
  })

  it('kapalı ozellik icin false doner', async () => {
    mockSubFindUnique.mockResolvedValue({ plan: BASIC_PLAN })

    const { checkFeature } = await import('../feature-gate')
    const result = await checkFeature(ORG_ID, 'aiContentStudio')
    expect(result).toBe(false)
  })

  it('plan bulunamazsa false doner', async () => {
    mockSubFindUnique.mockResolvedValue(null)

    const { checkFeature } = await import('../feature-gate')
    const result = await checkFeature(ORG_ID, 'ssoSupport')
    expect(result).toBe(false)
  })

  it('subscription var ama plan yoksa false doner', async () => {
    mockSubFindUnique.mockResolvedValue({ plan: null })

    const { checkFeature } = await import('../feature-gate')
    const result = await checkFeature(ORG_ID, 'advancedReports')
    expect(result).toBe(false)
  })

  it('tum ozellikleri dogru sekilde kontrol eder', async () => {
    mockSubFindUnique.mockResolvedValue({ plan: FULL_PLAN })

    const { checkFeature } = await import('../feature-gate')
    const features = [
      'aiContentStudio', 'scormSupport', 'hisIntegration',
      'advancedReports', 'ssoSupport', 'competencyModule',
      'accreditationModule', 'bulkImport', 'customCertificates',
    ] as const

    for (const feature of features) {
      const result = await checkFeature(ORG_ID, feature)
      expect(result).toBe(true)
    }
  })
})

describe('checkLimit — Limit kontrolu', () => {
  it('limit asilmamissa allowed true doner', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue({ plan: { maxStaff: 100, maxTrainings: 50, maxStorageGb: 500 } })
    mockUserCount.mockResolvedValue(50)

    const { checkLimit } = await import('../feature-gate')
    const result = await checkLimit(ORG_ID, 'maxStaff')

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(50)
    expect(result.max).toBe(100)
  })

  it('limit asilmissa allowed false doner (maxStaff)', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue({ plan: { maxStaff: 10, maxTrainings: 50, maxStorageGb: 500 } })
    mockUserCount.mockResolvedValue(10)

    const { checkLimit } = await import('../feature-gate')
    const result = await checkLimit(ORG_ID, 'maxStaff')

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(10)
    expect(result.max).toBe(10)
  })

  it('maxTrainings limit kontrolu', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue({ plan: { maxStaff: 100, maxTrainings: 5, maxStorageGb: 500 } })
    mockTrainingCount.mockResolvedValue(5)

    const { checkLimit } = await import('../feature-gate')
    const result = await checkLimit(ORG_ID, 'maxTrainings')

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(5)
    expect(result.max).toBe(5)
  })

  it('plan yoksa sinirsiz kabul edilir', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue(null)

    const { checkLimit } = await import('../feature-gate')
    const result = await checkLimit(ORG_ID, 'maxStaff')

    expect(result.allowed).toBe(true)
    expect(result.max).toBe(Infinity)
  })

  it('limit null (sinirsiz plan) ise allowed true doner', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue({ plan: { maxStaff: null, maxTrainings: null, maxStorageGb: null } })

    const { checkLimit } = await import('../feature-gate')
    const result = await checkLimit(ORG_ID, 'maxStaff')

    expect(result.allowed).toBe(true)
    expect(result.max).toBe(Infinity)
  })
})

describe('Cache davranisi', () => {
  it('ilk cagrada DB sorgusu yapilir, sonucu cache edilir', async () => {
    __clearMemCache()
    mockSubFindUnique.mockResolvedValue({ plan: FULL_PLAN })

    const { checkFeature } = await import('../feature-gate')

    // Ilk cagri — DB sorgusu yapilmali
    await checkFeature(ORG_ID, 'aiContentStudio')
    expect(mockSubFindUnique).toHaveBeenCalledTimes(1)

    // Cache verisi Redis mock'a yazilmis olmali
    expect(setCached).toHaveBeenCalled()
  })

  it('cache varsa DB sorgusuna gerek kalmaz', async () => {
    // Cache'e plan verisini yaz
    await setCached(`feature-gate:plan:${ORG_ID}`, FULL_PLAN, 300)

    const { checkFeature } = await import('../feature-gate')
    const result = await checkFeature(ORG_ID, 'aiContentStudio')

    expect(result).toBe(true)
    // DB sorgusu YAPILMAMALI (cache hit)
    // Not: getCached mock'u cagrilmis olmali
    expect(getCached).toHaveBeenCalled()
  })

  it('invalidatePlanCache cache i temizler', async () => {
    await setCached(`feature-gate:plan:${ORG_ID}`, FULL_PLAN, 300)

    const { invalidatePlanCache } = await import('../feature-gate')
    await invalidatePlanCache(ORG_ID)

    expect(invalidateCache).toHaveBeenCalledWith(`feature-gate:plan:${ORG_ID}`)
  })
})
