import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn(), findFirst: vi.fn() },
    organizationSubscription: { create: vi.fn() },
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/redis'

const mockOrgFindUnique = vi.mocked(prisma.organization.findUnique)
const mockOrgCreate = vi.mocked(prisma.organization.create)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUserCreate = vi.mocked(prisma.user.create)
const mockPlanFindFirst = vi.mocked(prisma.subscriptionPlan.findFirst)
const mockSubCreate = vi.mocked(prisma.organizationSubscription.create)
const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockCheckRateLimit = vi.mocked(checkRateLimit)

function createRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  hospitalName: 'Ankara Hastanesi',
  hospitalCode: 'ankara-hastanesi',
  adminEmail: 'admin@ankara.com',
  adminPassword: 'SecurePass123!',
  adminFirstName: 'Ahmet',
  adminLastName: 'Yilmaz',
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(true)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false)

    const response = await POST(createRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('Çok fazla kayıt denemesi')
  })

  it('returns 400 for invalid body (missing fields)', async () => {
    const response = await POST(createRequest({ hospitalName: 'A' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeTruthy()
  })

  it('returns 400 when hospital code already exists', async () => {
    mockOrgFindUnique.mockResolvedValue({ id: 'existing-org', code: 'ankara-hastanesi' } as never)

    const response = await POST(createRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Bu hastane kodu zaten kullanılıyor')
  })

  it('returns 400 when email already registered', async () => {
    mockOrgFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ id: 'existing-user', email: 'admin@ankara.com' } as never)

    const response = await POST(createRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Bu e-posta adresi zaten kayıtlı')
  })

  it('returns 201 on successful registration', async () => {
    // No existing org or user
    mockOrgFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue(null)

    // Free plan found
    mockPlanFindFirst.mockResolvedValue({
      id: 'plan-1',
      slug: 'free',
      isActive: true,
      priceMonthly: 0,
    } as never)

    // Org created
    mockOrgCreate.mockResolvedValue({
      id: 'new-org-1',
      name: 'Ankara Hastanesi',
      code: 'ankara-hastanesi',
      email: 'admin@ankara.com',
    } as never)

    // Subscription created
    mockSubCreate.mockResolvedValue({} as never)

    // Supabase auth user created
    const mockSupabase = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: {
              user: { id: 'supabase-user-1' },
            },
            error: null,
          }),
        },
      },
    }
    mockCreateServiceClient.mockResolvedValue(mockSupabase as never)

    // DB user created
    mockUserCreate.mockResolvedValue({
      id: 'supabase-user-1',
      email: 'admin@ankara.com',
      firstName: 'Ahmet',
      lastName: 'Yilmaz',
      role: 'admin',
      organizationId: 'new-org-1',
    } as never)

    const response = await POST(createRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.message).toContain('14 günlük deneme')
    expect(data.redirectUrl).toBe('/auth/login')

    // Verify the Supabase user was created with correct metadata
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@ankara.com',
        password: 'SecurePass123!',
        email_confirm: true,
        user_metadata: expect.objectContaining({
          role: 'admin',
          organization_id: 'new-org-1',
        }),
      })
    )
  })
})
