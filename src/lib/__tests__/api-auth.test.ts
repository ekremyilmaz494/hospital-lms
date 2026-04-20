import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

const mockSignInWithPassword = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createLoginClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
  createClient: vi.fn(async () => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}))

const mockCookiesGetAll = vi.fn(() => [] as { name: string; value: string }[])

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: mockCookiesGetAll,
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/redis', () => ({
  getRateLimitCount: vi.fn(async () => 0),
  incrementRateLimit: vi.fn(async () => 1),
  deleteRateLimit: vi.fn(async () => {}),
  getRedis: vi.fn(() => null),
  checkRateLimit: vi.fn(async () => true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => {}),
}))

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(async () => {}),
}))

vi.mock('@/lib/auth/trusted-device', () => ({
  isDeviceTrusted: vi.fn(async () => false),
  markDeviceTrusted: vi.fn(async () => {}),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

import { getRateLimitCount } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

const { POST } = await import('@/app/api/auth/login/route')
const { requireRole, getAuthUser } = await import('@/lib/api-helpers')

type AnyMock = ReturnType<typeof vi.fn<(...args: any[]) => any>>
const mockGetRateLimitCount = getRateLimitCount as AnyMock
const mockUserFindUnique = prisma.user.findUnique as AnyMock
const mockOrgFindUnique = prisma.organization.findUnique as AnyMock

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  }) as unknown as import('next/server').NextRequest
}

const activeDbUser = {
  id: 'user-1',
  isActive: true,
  mustChangePassword: false,
  role: 'admin',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetRateLimitCount.mockResolvedValue(0)
  mockUserFindUnique.mockResolvedValue(activeDbUser)
  mockCookiesGetAll.mockReturnValue([])
})

// ── Tests ──

describe('POST /api/auth/login', () => {
  describe('Basarili giris senaryolari', () => {
    it('gecerli kimlik bilgileriyle basarili giris yapar', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'admin@test.com', user_metadata: { role: 'admin' } },
          session: { user: { factors: [] } },
        },
        error: null,
      })

      const res = await POST(makeRequest({ email: 'admin@test.com', password: 'password123' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.user.id).toBe('user-1')
      expect(body.user.role).toBe('admin')
    })

    it('email adresini normalize eder (trim + lowercase)', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'staff@test.com', user_metadata: { role: 'staff' } },
          session: { user: { factors: [] } },
        },
        error: null,
      })

      await POST(makeRequest({ email: '  Staff@Test.COM  ', password: 'pass123' }))

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'staff@test.com',
        password: 'pass123',
      })
    })

    it('MFA gerektiren kullanici icin mfaRequired dondurir', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'mfa@test.com', user_metadata: { role: 'admin' } },
          session: {
            user: {
              factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
            },
          },
        },
        error: null,
      })

      const res = await POST(makeRequest({ email: 'mfa@test.com', password: 'pass123' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.mfaRequired).toBe(true)
      expect(body.factorId).toBe('factor-1')
      expect(body.user).toBeUndefined()
    })
  })

  describe('Basarisiz giris senaryolari', () => {
    it('email veya sifre eksik oldugunda 400 doner', async () => {
      const res1 = await POST(makeRequest({ email: 'test@test.com' }))
      expect(res1.status).toBe(400)

      const res2 = await POST(makeRequest({ password: 'pass123' }))
      expect(res2.status).toBe(400)

      const res3 = await POST(makeRequest({}))
      expect(res3.status).toBe(400)
    })

    it('yanlis kimlik bilgilerinde 401 doner', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      const res = await POST(makeRequest({ email: 'wrong@test.com', password: 'wrongpass' }))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error).toContain('hatalı')
    })
  })

  describe('Rate limiting', () => {
    it('IP rate limit asildiginda 429 doner', async () => {
      mockGetRateLimitCount
        .mockResolvedValueOnce(100) // IP over limit
        .mockResolvedValueOnce(0)

      const res = await POST(makeRequest({ email: 'test@test.com', password: 'pass' }))
      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error).toContain('fazla giriş denemesi')
    })

    it('email rate limit asildiginda 429 doner', async () => {
      mockGetRateLimitCount
        .mockResolvedValueOnce(0)  // IP OK
        .mockResolvedValueOnce(30) // email over limit

      const res = await POST(makeRequest({ email: 'test@test.com', password: 'pass' }))
      expect(res.status).toBe(429)
    })
  })

  describe('Rol kontrolu', () => {
    it('role metadata yoksa varsayilan staff rolu doner', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'norole@test.com', user_metadata: {} },
          session: { user: { factors: [] } },
        },
        error: null,
      })

      const res = await POST(makeRequest({ email: 'norole@test.com', password: 'pass123' }))
      const body = await res.json()

      expect(body.user.role).toBe('staff')
    })
  })
})

describe('getAuthUser - rol bazli erisim', () => {
  it('staff roluyle admin endpointi 403 doner', async () => {
    const result = requireRole('staff', ['admin', 'super_admin'])
    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(body.error).toBe('Forbidden')
  })

  it('admin roluyle super_admin endpointi 403 doner', () => {
    const result = requireRole('admin', ['super_admin'])
    expect(result).not.toBeNull()
  })

  it('super_admin tum rollere erisebilir', () => {
    expect(requireRole('super_admin', ['super_admin'])).toBeNull()
    expect(requireRole('super_admin', ['super_admin', 'admin'])).toBeNull()
  })
})

describe('getAuthUser - oturum kontrolleri', () => {
  it('auth cookie yoksa 401 doner', async () => {
    mockCookiesGetAll.mockReturnValue([])

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('oturum yoksa 401 doner', async () => {
    mockCookiesGetAll.mockReturnValue([{ name: 'sb-xxx-auth-token', value: 'x' }])
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('aktif olmayan kullanici 403 doner', async () => {
    mockCookiesGetAll.mockReturnValue([{ name: 'sb-xxx-auth-token', value: 'x' }])
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-inactive' } } },
      error: null,
    })
    mockUserFindUnique.mockResolvedValue({ id: 'user-inactive', isActive: false, role: 'staff' })

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toContain('not found or inactive')
  })

  it('askiya alinmis organizasyon 403 doner', async () => {
    mockCookiesGetAll.mockReturnValue([{ name: 'sb-xxx-auth-token', value: 'x' }])
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-suspended-org' } } },
      error: null,
    })
    mockUserFindUnique.mockResolvedValue({
      id: 'user-suspended-org',
      isActive: true,
      role: 'admin',
      organizationId: 'org-suspended',
    })
    mockOrgFindUnique.mockResolvedValue({ isActive: true, isSuspended: true })

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toContain('askıya alınmıştır')
  })
})
