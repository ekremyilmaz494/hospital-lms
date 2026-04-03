import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock'lar — route dosyasının bağımlılıkları
const mockGetAuthUser = vi.fn()
const mockRequireRole = vi.fn()
const mockJsonResponse = vi.fn(
  (data: unknown, status = 200) => Response.json(data, { status }),
)
const mockErrorResponse = vi.fn(
  (msg: string, status = 400) => Response.json({ error: msg }, { status }),
)
const mockParseBody = vi.fn()

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: mockGetAuthUser,
  requireRole: mockRequireRole,
  jsonResponse: mockJsonResponse,
  errorResponse: mockErrorResponse,
  parseBody: mockParseBody,
}))

vi.mock('@/lib/s3', () => ({
  getUploadUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned'),
  videoKey: vi.fn().mockReturnValue('org-123/training-456/video.mp4'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { POST } from '../route'

/** Yardımcı: sahte Request nesnesi oluşturur */
function fakeRequest(body?: Record<string, unknown>): Request {
  return new Request('http://localhost/api/upload/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/upload/video', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Varsayılan: başarılı auth ve admin rolü
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

    const res = await POST(fakeRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('admin olmayan kullanıcıda 403 döndürür', async () => {
    const errorRes = Response.json({ error: 'Forbidden' }, { status: 403 })
    mockRequireRole.mockReturnValue(errorRes)

    const res = await POST(fakeRequest())

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('zorunlu alanlar eksikse 400 döndürür', async () => {
    mockParseBody.mockResolvedValue({ fileName: 'test.mp4' })

    const res = await POST(fakeRequest({ fileName: 'test.mp4' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('zorunlu')
  })

  it('izin verilmeyen MIME türünde 400 döndürür', async () => {
    mockParseBody.mockResolvedValue({
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      trainingId: 'training-1',
    })

    const res = await POST(fakeRequest())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('İzin verilmeyen dosya türü')
  })

  it('izin verilmeyen dosya uzantısında 400 döndürür', async () => {
    mockParseBody.mockResolvedValue({
      fileName: 'virus.exe',
      contentType: 'video/mp4',
      fileSize: 1024,
      trainingId: 'training-1',
    })

    const res = await POST(fakeRequest())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Geçersiz dosya uzantısı')
  })

  it('5GB üzeri dosya boyutunda 400 döndürür', async () => {
    const sixGB = 6 * 1024 * 1024 * 1024
    mockParseBody.mockResolvedValue({
      fileName: 'large-video.mp4',
      contentType: 'video/mp4',
      fileSize: sixGB,
      trainingId: 'training-1',
    })

    const res = await POST(fakeRequest())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('5GB')
  })

  it('geçerli istekte presigned URL döndürür', async () => {
    mockParseBody.mockResolvedValue({
      fileName: 'egitim-video.mp4',
      contentType: 'video/mp4',
      fileSize: 50 * 1024 * 1024, // 50MB
      trainingId: 'training-1',
    })

    const res = await POST(fakeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toBe('https://s3.example.com/presigned')
    expect(body.key).toBe('org-123/training-456/video.mp4')
    expect(body.contentType).toBe('video/mp4')
    expect(body.fileSize).toBe(50 * 1024 * 1024)
  })
})
