import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(),
  jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
  errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET } from '../stats/route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)

/**
 * `/api/admin/dashboard/stats` 2026-05 itibarıyla deprecate edildi
 * (commit ab7e1a5 — split endpoint cleanup). Route artık her durumda 410 döner.
 * Dashboard verisi `/api/admin/dashboard/combined` üzerinden alınıyor.
 *
 * Bu test dosyası deprecation davranışını koruma altına alır:
 *   - Kimlik doğrulamasız istek → 401 (withAdminRoute wrapper)
 *   - Yetkisiz rol → 403 (withAdminRoute wrapper)
 *   - Yetkili admin → 410 Gone (deprecation cevabı)
 *
 * Eğer biri route'un işlevsel kısmını "yeniden canlandırırsa" bu test başarısız
 * olur ve PR review'da yakalanır.
 */
describe('GET /api/admin/dashboard/stats (deprecated → 410 Gone)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: null,
      dbUser: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/admin/dashboard/stats'))
    expect(response.status).toBe(401)
  })

  it('returns 403 when not admin role', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'user-1' },
      dbUser: { id: 'user-1', role: 'staff', organizationId: 'org-1', isActive: true },
      error: null,
    } as never)

    mockRequireRole.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    )

    const response = await GET(new Request('http://localhost/api/admin/dashboard/stats'))
    expect(response.status).toBe(403)
  })

  it('returns 410 Gone for authenticated admin (deprecation contract)', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'admin-1' },
      dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1', isActive: true },
      error: null,
    } as never)

    mockRequireRole.mockReturnValue(null)

    const response = await GET(new Request('http://localhost/api/admin/dashboard/stats'))
    const data = await response.json()

    expect(response.status).toBe(410)
    expect(data.error).toMatch(/combined/i)
  })
})
