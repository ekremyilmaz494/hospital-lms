import { describe, it, expect, vi, beforeEach } from 'vitest'

// Gerçek api-helpers modülü prisma'yı import eder; worktree'de DATABASE_URL yok → prisma.ts
// yüklenirken patlar. Mock'la (getAuthUser mock'landığı için gerçek prisma'ya gerek yok).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

// api-handler kullanıcıyı getAuthUser()/getAuthUserStrict() ile çözer (api-handler.ts:166).
// Yalnız bu ikisini mock'la; requireRole/errorResponse/jsonResponse GERÇEK kalsın.
const mockGetAuthUser = vi.fn()
const mockGetAuthUserStrict = vi.fn()

vi.mock('@/lib/api-helpers', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-helpers')>()
  return {
    ...actual,
    getAuthUser: () => mockGetAuthUser(),
    getAuthUserStrict: () => mockGetAuthUserStrict(),
  }
})

import { withAdminRoute, withSuperAdminRoute } from '@/lib/api-handler'

function authResult(dbUser: Record<string, unknown>) {
  return { user: { id: dbUser.id }, dbUser, error: null, organizationId: (dbUser.organizationId as string) ?? null }
}

const base = { organizationId: 'org1', mustChangePassword: false, isActive: true }
const grantedStaff = { ...base, id: 's1', role: 'staff', adminAccessGranted: true }
const plainStaff = { ...base, id: 's2', role: 'staff', adminAccessGranted: false }
const realAdmin = { ...base, id: 'a1', role: 'admin', adminAccessGranted: false }

function req(method = 'GET') {
  return new Request('https://x/api/test', { method })
}
const routeCtx = { params: Promise.resolve({}) } as never

beforeEach(() => {
  mockGetAuthUser.mockReset()
  mockGetAuthUserStrict.mockReset()
})

describe('withApiHandler — grant-duyarlı yetki (dual-capability)', () => {
  it('ek yönetici yetkisi verilmiş personel admin route\'a GİREBİLİR (200)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(grantedStaff))
    const handler = withAdminRoute(async () => new Response('ok'))
    const res = await handler(req(), routeCtx)
    expect(res.status).toBe(200)
  })

  it('grant\'sız düz personel admin route\'a GİREMEZ (403)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(plainStaff))
    const handler = withAdminRoute(async () => new Response('ok'))
    const res = await handler(req(), routeCtx)
    expect(res.status).toBe(403)
  })

  it('KRİTİK GÜVENLİK: grant super_admin route\'unu GEÇMEZ (403)', async () => {
    // Grant yalnız hastane-admin seviyesi verir; super_admin ASLA.
    mockGetAuthUserStrict.mockResolvedValue(authResult(grantedStaff))
    const handler = withSuperAdminRoute(async () => new Response('ok'))
    const res = await handler(req(), routeCtx)
    expect(res.status).toBe(403)
  })

  it('gerçek admin admin route\'a girer (regresyon)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(realAdmin))
    const handler = withAdminRoute(async () => new Response('ok'))
    const res = await handler(req(), routeCtx)
    expect(res.status).toBe(200)
  })
})
