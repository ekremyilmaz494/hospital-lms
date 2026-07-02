/**
 * subscription-guard on-prem dalları — lisans durumu abonelik fonksiyonlarını
 * SÜRER: READONLY→isExpired (yazma bloğu), limitler lisans claim'lerinden global.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getLicenseStateMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/license/cache', () => ({ getLicenseState: getLicenseStateMock }))

const prismaMock = vi.hoisted(() => ({
  user: { count: vi.fn() },
  organization: { count: vi.fn() },
  organizationSubscription: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({ getCached: vi.fn().mockResolvedValue(null), setCached: vi.fn() }))

import { checkSubscriptionStatus, checkSubscriptionLimit } from '@/lib/subscription-guard'

function license(state: string, limits: { maxStaff: number | null; maxOrganizations: number | null } | null = null, daysToExpiry: number | null = 100) {
  getLicenseStateMock.mockResolvedValue({ state, limits, daysToExpiry })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
  vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('checkSubscriptionStatus — on-prem lisans güdümlü', () => {
  it('VALID → active (yazma serbest)', async () => {
    license('VALID', null, 200)
    const r = await checkSubscriptionStatus('org')
    expect(r).toMatchObject({ status: 'active', isExpired: false, daysLeft: 200 })
  })

  it('WARN → yine active', async () => {
    license('WARN', null, 20)
    expect((await checkSubscriptionStatus('org')).isExpired).toBe(false)
  })

  it('READONLY → isExpired (mevcut write-guard yazmayı bloklar)', async () => {
    license('READONLY')
    const r = await checkSubscriptionStatus('org')
    expect(r.isExpired).toBe(true)
    expect(r.status).toBe('expired')
  })

  it('LOCKED → suspended/expired', async () => {
    license('LOCKED')
    expect((await checkSubscriptionStatus('org')).isExpired).toBe(true)
  })

  it('abonelik tablosuna DOKUNMAZ (on-prem)', async () => {
    license('VALID')
    await checkSubscriptionStatus('org')
    expect(prismaMock.organizationSubscription.findUnique).not.toHaveBeenCalled()
  })
})

describe('checkSubscriptionLimit — on-prem global limitler', () => {
  it('personel limiti aşılınca 403', async () => {
    license('VALID', { maxStaff: 500, maxOrganizations: 1 })
    prismaMock.user.count.mockResolvedValue(500)
    const res = await checkSubscriptionLimit('org', 'staff')
    expect(res?.status).toBe(403)
    // Global sayım (organizationId filtresi yok)
    expect(prismaMock.user.count).toHaveBeenCalledWith({ where: { role: 'staff' } })
  })

  it('personel limiti altında → null', async () => {
    license('VALID', { maxStaff: 500, maxOrganizations: 1 })
    prismaMock.user.count.mockResolvedValue(499)
    expect(await checkSubscriptionLimit('org', 'staff')).toBeNull()
  })

  it('organizasyon limiti aşılınca 403 (global org sayımı)', async () => {
    license('VALID', { maxStaff: null, maxOrganizations: 3 })
    prismaMock.organization.count.mockResolvedValue(3)
    const res = await checkSubscriptionLimit('', 'organization')
    expect(res?.status).toBe(403)
  })

  it('limit null (sınırsız) → serbest', async () => {
    license('VALID', { maxStaff: null, maxOrganizations: null })
    expect(await checkSubscriptionLimit('org', 'staff')).toBeNull()
    expect(await checkSubscriptionLimit('', 'organization')).toBeNull()
  })

  it('training limiti lisansta yok → serbest', async () => {
    license('VALID', { maxStaff: 500, maxOrganizations: 1 })
    expect(await checkSubscriptionLimit('org', 'training')).toBeNull()
  })
})
