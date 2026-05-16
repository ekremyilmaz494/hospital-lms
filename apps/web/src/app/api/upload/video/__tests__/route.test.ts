import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetAuthUser, mockRequireRole, authState } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockRequireRole: vi.fn(),
  authState: { dbUser: null as unknown, organizationId: null as string | null },
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: mockGetAuthUser,
  requireRole: mockRequireRole,
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))

// withAdminRoute'u sade bir wrapper olarak mock'la — auth pre-flight'ı test stub'ına devret
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: { request: Request; dbUser: unknown; organizationId: string | null; audit: () => Promise<void> }) => Promise<Response>) => {
    return async (request: Request) => {
      const auth = await mockGetAuthUser()
      if (auth.error) return auth.error
      const roleErr = mockRequireRole(auth.dbUser?.role, ['admin', 'super_admin'])
      if (roleErr) return roleErr
      if (!auth.dbUser?.organizationId) {
        return Response.json({ error: 'Bu işlem için bir kurum bağlamı gerekir' }, { status: 400 })
      }
      return handler({
        request,
        dbUser: auth.dbUser,
        organizationId: auth.dbUser.organizationId,
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

vi.mock('@/lib/s3', () => ({
  getUploadUrl: vi.fn().mockResolvedValue('https://s3.example/upload-url'),
  videoKey: vi.fn().mockReturnValue('org-123/drafts/video.mp4'),
  checkStorageQuota: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

import { POST } from '../route'

void authState

function jsonRequest(body?: Record<string, unknown>): Request {
  return new Request('http://localhost/api/upload/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  })
}

describe('POST /api/upload/video (presigned URL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue({
      dbUser: {
        id: 'user-1',
        role: 'admin',
        organizationId: 'org-123',
      },
      error: null,
    })
    mockRequireRole.mockReturnValue(null)
  })

  it('kimlik doğrulanmamış kullanıcıda 401 döndürür', async () => {
    const errorRes = Response.json({ error: 'Unauthorized' }, { status: 401 })
    mockGetAuthUser.mockResolvedValue({ dbUser: null, error: errorRes })

    const res = await POST(jsonRequest({ fileName: 'v.mp4', contentType: 'video/mp4' }))

    expect(res.status).toBe(401)
  })

  it('admin olmayan kullanıcıda 403 döndürür', async () => {
    const errorRes = Response.json({ error: 'Forbidden' }, { status: 403 })
    mockRequireRole.mockReturnValue(errorRes)

    const res = await POST(jsonRequest({ fileName: 'v.mp4', contentType: 'video/mp4' }))

    expect(res.status).toBe(403)
  })

  it('fileName veya contentType eksikse 400 döndürür', async () => {
    const res = await POST(jsonRequest({}))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('fileName ve contentType')
  })

  it('izin verilmeyen MIME türünde 400 döndürür', async () => {
    const res = await POST(jsonRequest({ fileName: 'doc.pdf', contentType: 'application/pdf' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Izin verilmeyen dosya turu')
  })

  it('500MB limitini aşan dosyalarda 400 döndürür', async () => {
    const res = await POST(jsonRequest({
      fileName: 'big.mp4',
      contentType: 'video/mp4',
      fileSize: 600 * 1024 * 1024,
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('500MB')
  })

  it('geçerli istekte presigned URL döndürür', async () => {
    const res = await POST(jsonRequest({
      fileName: 'egitim-video.mp4',
      contentType: 'video/mp4',
      fileSize: 50 * 1024 * 1024,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toBe('https://s3.example/upload-url')
    expect(body.key).toBe('org-123/drafts/video.mp4')
    expect(body.fileName).toBe('egitim-video.mp4')
  })
})
