import { describe, it, expect, vi, beforeEach } from 'vitest'

// Gerçek prisma'ya gerek yok — getAuthUser + orgInOwnerGroup mock'landı.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/api-helpers', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-helpers')>()
  return {
    ...actual,
    getAuthUser: () => mockGetAuthUser(),
    // Write-guard'ı testte nötrle (subscription-guard prisma'ya gider); asıl test acting-mode kararı.
    checkWritePermission: async () => null,
  }
})

const mockVerifyToken = vi.fn()
vi.mock('@/lib/auth/acting-org', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/auth/acting-org')>()
  return { ...actual, verifyActingOrgToken: (...args: unknown[]) => mockVerifyToken(...args) }
})

const mockOrgInGroup = vi.fn()
vi.mock('@/lib/auth/group-drill-in', () => ({
  orgInOwnerGroup: (...args: unknown[]) => mockOrgInGroup(...args),
}))

vi.mock('@/lib/license/enforcement', () => ({
  licenseApiGate: async () => ({ blocked: false }),
  isReadonlyWriteExempt: () => false,
}))

import { withAdminRoute } from '@/lib/api-handler'

function authResult(dbUser: Record<string, unknown>) {
  return { user: { id: dbUser.id }, dbUser, error: null, organizationId: (dbUser.organizationId as string) ?? null }
}

const groupOwner = { id: 'go1', role: 'admin', organizationId: null, groupId: 'grpA', adminAccessGranted: false, mustChangePassword: false, isActive: true }
const superAdmin = { id: 'sa1', role: 'super_admin', organizationId: null, groupId: null, adminAccessGranted: false, mustChangePassword: false, isActive: true }
const plainAdmin = { id: 'a1', role: 'admin', organizationId: 'orgOwn', groupId: null, adminAccessGranted: false, mustChangePassword: false, isActive: true }

function req(method = 'GET') {
  return new Request('https://x/api/admin/test', { method, headers: { cookie: 'klx-acting-org=fake' } })
}
const routeCtx = { params: Promise.resolve({}) } as never

beforeEach(() => {
  mockGetAuthUser.mockReset()
  mockVerifyToken.mockReset()
  mockOrgInGroup.mockReset()
})

describe('withApiHandler — grup drill-in acting modları', () => {
  it('grup yöneticisi KENDİ grubundaki hastaneye girer → ctx.organizationId = hedef org', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(groupOwner))
    mockVerifyToken.mockReturnValue('orgB')
    mockOrgInGroup.mockResolvedValue(true)
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('GET'), routeCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: 'orgB' })
  })

  it('GÜVENLİK: grup yöneticisi grubu DIŞINDAKİ hastaneye giremez → drill-in reddedilir (org null)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(groupOwner))
    mockVerifyToken.mockReturnValue('orgX')
    mockOrgInGroup.mockResolvedValue(false)
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('GET'), routeCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: null })
  })

  it('TAM KONTROL: grup yöneticisi drill-in modda YAZABİLİR (POST 200, salt-okunur ray YOK)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(groupOwner))
    mockVerifyToken.mockReturnValue('orgB')
    mockOrgInGroup.mockResolvedValue(true)
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('POST'), routeCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: 'orgB' })
  })

  it('REGRESYON: super_admin acting-org HÂLÂ salt-okunur (POST → 403)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(superAdmin))
    mockVerifyToken.mockReturnValue('orgB')
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('POST'), routeCtx)
    expect(res.status).toBe(403)
  })

  it('super_admin acting-org GET okur (org scope = hedef org)', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(superAdmin))
    mockVerifyToken.mockReturnValue('orgB')
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('GET'), routeCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: 'orgB' })
  })

  it('sıradan admin (grup yok) acting cookie\'sinden ETKİLENMEZ → kendi org\'unda kalır', async () => {
    mockGetAuthUser.mockResolvedValue(authResult(plainAdmin))
    mockVerifyToken.mockReturnValue('orgB') // cookie olsa bile grup yetkisi yok
    mockOrgInGroup.mockResolvedValue(true)
    const handler = withAdminRoute(async ({ organizationId }) => Response.json({ organizationId }))
    const res = await handler(req('POST'), routeCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: 'orgOwn' })
  })
})
