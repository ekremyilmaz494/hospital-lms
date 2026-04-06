import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

const mockSignInWithPassword = vi.fn()
const mockListFactors = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      mfa: { listFactors: mockListFactors },
    },
  })),
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn(async () => true),
  getRedis: vi.fn(() => null),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => {}),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

import { checkRateLimit } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

// Top-level dynamic imports (after mocks are set up)
const { POST } = await import('@/app/api/auth/login/route')
const { requireRole, getAuthUser } = await import('@/lib/api-helpers')
const { createClient: mockCreateClient } = await import('@/lib/supabase/server')

const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  }) as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  mockListFactors.mockResolvedValue({ data: { totp: [] } })
})

// ── Tests ──

describe('POST /api/auth/login', () => {
  describe('Basarili giris senaryolari', () => {
    it('gecerli kimlik bilgileriyle basarili giris yapar', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'admin@test.com', user_metadata: { role: 'admin' } },
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
          user: { id: 'user-2', email: 'staff@test.com', user_metadata: { role: 'staff' } },
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
          user: { id: 'user-mfa', email: 'mfa@test.com', user_metadata: { role: 'admin' } },
        },
        error: null,
      })
      mockListFactors.mockResolvedValue({
        data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      })

      const res = await POST(makeRequest({ email: 'mfa@test.com', password: 'pass123' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.mfaRequired).toBe(true)
      expect(body.factorId).toBe('factor-1')
      // Kullanici bilgisi sizdirilmamali
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
      ;(checkRateLimit as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(false) // IP limit
        .mockResolvedValueOnce(true)  // email limit

      const res = await POST(makeRequest({ email: 'test@test.com', password: 'pass' }))
      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error).toContain('fazla giriş denemesi')
    })

    it('email rate limit asildiginda 429 doner', async () => {
      ;(checkRateLimit as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true)  // IP limit OK
        .mockResolvedValueOnce(false) // email limit exceeded

      const res = await POST(makeRequest({ email: 'test@test.com', password: 'pass' }))
      expect(res.status).toBe(429)
    })
  })

  describe('Rol kontrolu', () => {
    it('role metadata yoksa varsayilan staff rolu doner', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-no-role', email: 'norole@test.com', user_metadata: {} },
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
  it('oturum yoksa 401 doner', async () => {
    ;(mockCreateClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    })

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('aktif olmayan kullanici 403 doner', async () => {
    ;(mockCreateClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getSession: async () => ({
        data: { session: { user: { id: 'user-inactive' } } },
        error: null,
      }) },
    })
    mockUserFindUnique.mockResolvedValue({ id: 'user-inactive', isActive: false, role: 'staff' })

    const { error } = await getAuthUser()

    expect(error).not.toBeNull()
    const body = await error!.json()
    expect(body.error).toContain('not found or inactive')
  })

  it('askiya alinmis organizasyon 403 doner', async () => {
    ;(mockCreateClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getSession: async () => ({
        data: { session: { user: { id: 'user-suspended-org' } } },
        error: null,
      }) },
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
