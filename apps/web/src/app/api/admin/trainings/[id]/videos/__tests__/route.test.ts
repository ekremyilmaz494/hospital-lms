import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Bu test dosyası "Video URL Kuralı"nın (CLAUDE.md) en kritik kısmını koruma altına alır:
 *
 *   1. Upload route ASLA raw CloudFront URL'sini DB'ye yazmaz (`videoUrl: ''` zorunlu).
 *      Bu kural 5-6 kez bozulup geri geldi. Pre-commit (perf-check.js) + bu test
 *      birlikte regresyonu engeller. Bkz: [src/lib/training-video-url.ts] sözleşmesi.
 *
 *   2. Audio mediaType `audioKey()` çağırır, `videoKey()` değil (key family ayrımı).
 */

const { prismaMock, s3Mock } = vi.hoisted(() => ({
  prismaMock: {
    training: { findFirst: vi.fn() },
    trainingVideo: { create: vi.fn() },
  },
  s3Mock: {
    getUploadUrl: vi.fn().mockResolvedValue('https://s3.example/upload-url'),
    videoKey: vi.fn().mockReturnValue('videos/org-1/training-1/video.mp4'),
    documentKey: vi.fn().mockReturnValue('documents/org-1/training-1/doc.pdf'),
    audioKey: vi.fn().mockReturnValue('audio/org-1/training-1/audio.mp3'),
    deleteObject: vi.fn(),
    checkStorageQuota: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        request,
        params: await params,
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { POST } from '../route'

function uploadRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/admin/trainings/training-1/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const trainingFixture = { id: 'training-1', organizationId: 'org-1' }

describe('POST /api/admin/trainings/[id]/videos (upload) — Video URL Kuralı', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.training.findFirst.mockResolvedValue(trainingFixture)
    prismaMock.trainingVideo.create.mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve({
      id: 'video-1',
      ...args.data,
    }))
  })

  it('video upload: DB\'ye videoUrl="" yazar — raw CloudFront URL ASLA yazılmaz', async () => {
    process.env.AWS_CLOUDFRONT_DOMAIN = 'https://test-cdn.cloudfront.net'

    const res = await POST(uploadRequest({
      filename: 'egitim.mp4',
      contentType: 'video/mp4',
      title: 'Test Eğitim',
      durationSeconds: 600,
      mediaType: 'video',
    }), { params: Promise.resolve({ id: 'training-1' }) })

    expect(res.status).toBe(201)
    expect(prismaMock.trainingVideo.create).toHaveBeenCalledOnce()

    const writtenData = prismaMock.trainingVideo.create.mock.calls[0][0].data as Record<string, unknown>

    // KRİTİK: videoUrl boş string olmalı — raw CloudFront URL DB'ye yazılmamalı
    expect(writtenData.videoUrl).toBe('')
    expect(writtenData.videoUrl).not.toContain('cloudfront.net')
    expect(writtenData.videoUrl).not.toContain('https://')

    // videoKey ise S3 key'i içermeli (kanonik kaynak)
    expect(writtenData.videoKey).toBe('videos/org-1/training-1/video.mp4')
  })

  it('audio upload: audioKey() çağrılır, videoKey() değil (key family ayrımı)', async () => {
    const res = await POST(uploadRequest({
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
      title: 'Test Audio',
      durationSeconds: 300,
      mediaType: 'audio',
    }), { params: Promise.resolve({ id: 'training-1' }) })

    expect(res.status).toBe(201)
    expect(s3Mock.audioKey).toHaveBeenCalledWith('org-1', 'training-1', 'audio.mp3')
    expect(s3Mock.videoKey).not.toHaveBeenCalled()
  })

  it('pdf upload: documentKey() çağrılır, videoKey()/audioKey() değil', async () => {
    const res = await POST(uploadRequest({
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      title: 'Test PDF',
      durationSeconds: 0,
      mediaType: 'pdf',
      pageCount: 10,
    }), { params: Promise.resolve({ id: 'training-1' }) })

    expect(res.status).toBe(201)
    expect(s3Mock.documentKey).toHaveBeenCalledWith('org-1', 'training-1', 'doc.pdf')
    expect(s3Mock.videoKey).not.toHaveBeenCalled()
    expect(s3Mock.audioKey).not.toHaveBeenCalled()
  })
})
