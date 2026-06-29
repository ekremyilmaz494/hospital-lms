import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, seedDemoOrganizationMock, rateLimitMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    organization: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  seedDemoOrganizationMock: vi.fn(),
  rateLimitMock: vi.fn().mockResolvedValue(true),
  auditMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/demo-seed', () => ({ seedDemoOrganization: seedDemoOrganizationMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: rateLimitMock }))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) => Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try {
      return await req.json()
    } catch {
      return null
    }
  },
  safePagination: (params: URLSearchParams, maxLimit = 100) => {
    const page = Math.max(Number(params.get('page') || '1'), 1)
    const limit = Math.min(Math.max(Number(params.get('limit') || '20'), 1), maxLimit)
    return { page, limit, search: params.get('search') ?? '', skip: (page - 1) * limit }
  },
}))
vi.mock('@/lib/api-handler', () => ({
  withSuperAdminRoute: <P,>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: null }
    audit: typeof auditMock
  }) => Promise<Response>) => async (request: Request) => handler({
    request,
    params: {} as P,
    dbUser: { id: 'super-1', role: 'super_admin', organizationId: null },
    audit: auditMock,
  }),
}))

import { GET, POST } from '../route'

describe('/api/super-admin/demos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue(true)
  })

  it('GET yalnız demo organizasyonlarını listeler ve count ile aynı where kullanır', async () => {
    prismaMock.organization.findMany.mockResolvedValue([])
    prismaMock.organization.count.mockResolvedValue(0)

    const res = await GET(new Request('http://localhost/api/super-admin/demos?limit=50'))
    expect(res.status).toBe(200)

    expect(prismaMock.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isDemo: true },
      take: 50,
    }))
    expect(prismaMock.organization.count).toHaveBeenCalledWith({ where: { isDemo: true } })
  })

  it('POST varsayılan olarak dolu demo üretir ve credential döner', async () => {
    seedDemoOrganizationMock.mockResolvedValue({
      orgId: 'org-demo-1',
      orgName: 'Demo Hastane #1',
      adminEmail: 'admin@demo.local',
      adminTc: '10000000146',
      tempPassword: 'PassABCDEF12!1',
    })

    const res = await POST(new Request('http://localhost/api/super-admin/demos', {
      method: 'POST',
      body: JSON.stringify({}),
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(seedDemoOrganizationMock).toHaveBeenCalledWith({ filled: true, createdByUserId: 'super-1' })
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'demo.create' }))
    expect(body.tempPassword).toBe('PassABCDEF12!1')
  })
})
