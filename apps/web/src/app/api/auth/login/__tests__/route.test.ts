import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsonResponse/errorResponse — basit, gerçeğe denk Response sarmalayıcıları
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  errorResponse: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } }),
}))

vi.mock('@/lib/redis', () => ({
  getRateLimitCount: vi.fn().mockResolvedValue(0),
  incrementRateLimit: vi.fn().mockResolvedValue(undefined),
  deleteRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/server', () => ({
  createLoginClient: vi.fn(),
  createServiceClient: vi.fn(async () => ({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  })),
}))

vi.mock('@/lib/supabase/verify-jwt', () => ({
  verifyAccessToken: vi.fn(async (token?: string) => {
    if (token === 'super_admin-token') {
      return { sub: 'user-1', role: 'super_admin', payload: { app_metadata: {} } }
    }
    if (token === 'admin-token') {
      return { sub: 'user-1', role: 'admin', payload: { app_metadata: { organization_id: 'org-1' } } }
    }
    if (token === 'group-owner-token') {
      // Grup yöneticisi: role=admin, org yok, group claim'leri set (JWT ↔ DB drift YOK).
      return { sub: 'user-1', role: 'admin', payload: { app_metadata: { group_owner: true, group_id: 'grp-1' } } }
    }
    return null
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth/trusted-device', () => ({ isDeviceTrusted: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/auth/login-lock', () => ({
  getAccountLock: vi.fn().mockResolvedValue({ locked: false, retryAfterSec: 0 }),
  registerFailedLogin: vi.fn().mockResolvedValue({ failCount: 0 }),
  LOGIN_LOCK: { threshold: 5, durationSec: 900 },
}))
vi.mock('@/lib/auth/ip-allowlist', () => ({ isIpAllowed: vi.fn().mockReturnValue(true) }))
vi.mock('@/lib/tc', () => ({
  isValidTcKimlik: vi.fn().mockReturnValue(true),
  normalizeTcKimlik: (v: string) => v,
}))
vi.mock('@/lib/tc-crypto', () => ({ hashTcKimlik: (v: string) => `hash-${v}` }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn() }),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { createLoginClient } from '@/lib/supabase/server'

const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockCreateLoginClient = vi.mocked(createLoginClient)

const SUSPEND_MESSAGE = 'Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.'

/** signInWithPassword başarılı dönecek şekilde Supabase login client mock'u. */
function mockSuccessfulAuth(role: string) {
  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'admin@deneme-organizasyonu.com', app_metadata: { role } },
          session: {
            access_token: `${role}-token`,
            refresh_token: 'rt',
            expires_at: 0,
            user: { factors: [] },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
  mockCreateLoginClient.mockResolvedValue(supabase as never)
  return supabase
}

/** Grup yöneticisi (esas yönetici) — role=admin, organizationId=null, group claim'leri set. */
function mockGroupOwnerAuth() {
  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'grup.yonetici@demo-grup.local',
            app_metadata: { role: 'admin', group_owner: true, group_id: 'grp-1' },
          },
          session: {
            access_token: 'group-owner-token',
            refresh_token: 'rt',
            expires_at: 0,
            user: { factors: [] },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
  mockCreateLoginClient.mockResolvedValue(supabase as never)
  return supabase
}

/** Grup yöneticisi dbUser kaydı — organizationId=null, groupId set, organization relation YOK. */
function groupOwnerDbUser() {
  return {
    id: 'user-1',
    mustChangePassword: false,
    isActive: true,
    role: 'admin',
    organizationId: null,
    groupId: 'grp-1',
    phone: null,
    phoneVerifiedAt: null,
    organization: null,
  }
}

/** dbUser kaydı — org.isSuspended / org.isActive ve role ayarlanabilir. */
function dbUser(role: string, isSuspended: boolean, isActive = true) {
  return {
    id: 'user-1',
    mustChangePassword: false,
    isActive: true,
    role,
    organizationId: role === 'super_admin' ? null : 'org-1',
    phone: null,
    phoneVerifiedAt: null,
    organization: {
      slug: 'deneme-org',
      isActive,
      isSuspended,
      smsMfaEnabled: false,
      setupCompleted: true,
      ipAllowlistEnabled: false,
      ipAllowlist: [],
    },
  }
}

function loginRequest() {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost' },
    body: JSON.stringify({ identifier: 'admin@deneme-organizasyonu.com', password: 'Demo1234!' }),
  })
}

describe('POST /api/auth/login — org suspend guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('askıya alınmış org\'un admin kullanıcısını 403 ile reddeder', async () => {
    mockSuccessfulAuth('admin')
    mockUserFindUnique.mockResolvedValue(dbUser('admin', true) as never)

    const res = await POST(loginRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe(SUSPEND_MESSAGE)
  })

  it('super_admin, org askıya alınmış olsa bile muaftır (girişe devam eder)', async () => {
    mockSuccessfulAuth('super_admin')
    mockUserFindUnique.mockResolvedValue(dbUser('super_admin', true) as never)

    const res = await POST(loginRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.error).toBeUndefined()
    expect(data.user?.role).toBe('super_admin')
  })

  it('pasif (isActive=false) org\'un kullanıcısını da 403 ile reddeder (checkOrgActive paritesi)', async () => {
    mockSuccessfulAuth('admin')
    mockUserFindUnique.mockResolvedValue(dbUser('admin', false, false) as never)

    const res = await POST(loginRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe(SUSPEND_MESSAGE)
  })

  it('askıya alınmamış org\'da normal giriş bozulmaz (regresyon)', async () => {
    mockSuccessfulAuth('admin')
    mockUserFindUnique.mockResolvedValue(dbUser('admin', false) as never)

    const res = await POST(loginRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.error).toBeUndefined()
    expect(data.organizationSlug).toBe('deneme-org')
  })

  // Canlı smoke'ta yakalanan bug (2026-07-11): grup yöneticisinin organizationId'si null
  // olduğu için `organization` relation da null → org-askı guard'ı yanlışlıkla 403 veriyordu.
  // Fix: guard'ı `dbUser.organizationId &&` ile kapıla (checkOrgActive `!organizationId`
  // short-circuit paritesi). super_admin gibi org'u olmayan grup yöneticisi de muaf.
  it('grup yöneticisi (organizationId=null) org-askı guard\'ından muaftır → giriş 200', async () => {
    mockGroupOwnerAuth()
    mockUserFindUnique.mockResolvedValue(groupOwnerDbUser() as never)

    const res = await POST(loginRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.error).toBeUndefined()
    expect(data.groupOwner).toBe(true)
    expect(data.organizationId).toBeNull()
  })
})
