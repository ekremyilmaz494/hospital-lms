import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POST /api/admin/content-library — Upload akışının kritik kuralları:
 *
 *  1. Storage quota: toplam yüklenecek byte + mevcut kullanım > plan limiti → 413
 *     (depolama limitiniz aşılıyor mesajı, presigned URL hiç üretilmez)
 *
 *  2. Duplicate (P2002): aynı (organizationId, s3Key) kombosu DB unique
 *     constraint'ini ihlal ettiğinde kullanıcıya nazik Türkçe hata; diğer
 *     dosyalar etkilenmez (Promise.allSettled).
 */

const { prismaMock, s3Mock } = vi.hoisted(() => ({
  prismaMock: {
    organizationSubscription: { findFirst: vi.fn() },
    contentLibrary: { create: vi.fn() },
  },
  s3Mock: {
    getUploadUrl: vi.fn().mockResolvedValue('https://s3.example/upload-url'),
    getStreamUrl: vi.fn().mockResolvedValue('https://cdn.example/signed'),
    videoKey: vi.fn().mockReturnValue('videos/org-1/content-library/file.mp4'),
    documentKey: vi.fn().mockReturnValue('documents/org-1/content-library/file.pdf'),
    audioKey: vi.fn().mockReturnValue('audio/org-1/content-library/file.mp3'),
    getOrgStorageBytes: vi.fn().mockResolvedValue(0),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  safePagination: () => ({ page: 1, limit: 50, skip: 0, search: '' }),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, ctx?: { params: Promise<P> }) => {
      return handler({
        request,
        params: ctx ? await ctx.params : ({} as P),
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { POST } from '../route'

function uploadRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/admin/content-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/content-library — Storage quota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    s3Mock.getOrgStorageBytes.mockResolvedValue(0)
    prismaMock.contentLibrary.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve({
        id: 'item-1',
        title: args.data.title,
        contentType: args.data.contentType,
        s3Key: args.data.s3Key,
        createdAt: new Date(),
      }),
    )
  })

  it('quota aşıldığında 413 döner, presigned URL üretilmez, DB\'ye yazılmaz', async () => {
    // Plan: 10GB, mevcut kullanım: 9.5GB, yüklenecek: 1GB → toplam 10.5GB > 10GB
    prismaMock.organizationSubscription.findFirst.mockResolvedValue({
      plan: { maxStorageGb: 10 },
    })
    s3Mock.getOrgStorageBytes.mockResolvedValue(9.5 * 1024 * 1024 * 1024)

    const res = await POST(uploadRequest({
      files: [{
        fileName: 'big.mp4',
        contentType: 'video/mp4',
        fileSize: 1 * 1024 * 1024 * 1024,
      }],
    }))

    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toContain('Depolama limitinizi aşıyor')
    expect(s3Mock.getUploadUrl).not.toHaveBeenCalled()
    expect(prismaMock.contentLibrary.create).not.toHaveBeenCalled()
  })

  it('quota dahilindeyse upload akışı normal devam eder', async () => {
    prismaMock.organizationSubscription.findFirst.mockResolvedValue({
      plan: { maxStorageGb: 10 },
    })
    s3Mock.getOrgStorageBytes.mockResolvedValue(1 * 1024 * 1024 * 1024) // 1GB mevcut

    const res = await POST(uploadRequest({
      files: [{
        fileName: 'normal.mp4',
        contentType: 'video/mp4',
        fileSize: 100 * 1024 * 1024, // 100MB
      }],
    }))

    expect(res.status).toBe(201)
    expect(s3Mock.getUploadUrl).toHaveBeenCalled()
    expect(prismaMock.contentLibrary.create).toHaveBeenCalledOnce()
  })

  it('fileSize gönderilmediğinde 400 döner, presign edilmez, DB\'ye yazılmaz', async () => {
    // fileSize artık ZORUNLU — eksikse kota hesaplanamaz, istek reddedilir
    const res = await POST(uploadRequest({
      files: [{
        fileName: 'no-size.mp4',
        contentType: 'video/mp4',
      }],
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Dosya boyutu eksik veya geçersiz')
    expect(s3Mock.getUploadUrl).not.toHaveBeenCalled()
    expect(prismaMock.contentLibrary.create).not.toHaveBeenCalled()
  })

  it('fileSize <= 0 olduğunda 400 döner', async () => {
    const res = await POST(uploadRequest({
      files: [{ fileName: 'zero.mp4', contentType: 'video/mp4', fileSize: 0 }],
    }))

    expect(res.status).toBe(400)
    expect(prismaMock.contentLibrary.create).not.toHaveBeenCalled()
  })

  it('fileSize number değilse 400 döner', async () => {
    const res = await POST(uploadRequest({
      files: [{ fileName: 'bad.mp4', contentType: 'video/mp4', fileSize: 'abc' }],
    }))

    expect(res.status).toBe(400)
    expect(s3Mock.getUploadUrl).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/content-library — Duplicate detection (P2002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    s3Mock.getOrgStorageBytes.mockResolvedValue(0)
  })

  it('P2002 unique constraint ihlali → dosya bazında Türkçe error mesajı', async () => {
    const p2002Err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    prismaMock.contentLibrary.create.mockRejectedValueOnce(p2002Err)

    const res = await POST(uploadRequest({
      files: [{
        fileName: 'dupe.mp4',
        contentType: 'video/mp4',
        fileSize: 1000,
      }],
    }))

    // 201 dönüyor ama results içinde hata bilgisi var (Promise.allSettled
    // pattern'i — bir dosyanın hatası diğerlerini engellemiyor)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].error).toBe('Bu dosya zaten kütüphanenizde mevcut')
    expect(body.results[0].fileName).toBe('dupe.mp4')
  })

  it('P2002 olmayan hatalar generic mesajla döner (Promise.allSettled reject path)', async () => {
    prismaMock.contentLibrary.create.mockRejectedValueOnce(new Error('Network blip'))

    const res = await POST(uploadRequest({
      files: [{
        fileName: 'other.mp4',
        contentType: 'video/mp4',
        fileSize: 1000,
      }],
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.results[0].error).toBe('Network blip')
    // 'Bu dosya zaten kütüphanenizde mevcut' mesajına dönüşmemeli
    expect(body.results[0].error).not.toContain('mevcut')
  })

  it('birden fazla dosya: birinde P2002 olsa diğerleri başarılı kalır', async () => {
    const p2002Err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    prismaMock.contentLibrary.create
      .mockResolvedValueOnce({
        id: 'item-1', title: 'a', contentType: 'video', s3Key: 'k1', createdAt: new Date(),
      })
      .mockRejectedValueOnce(p2002Err)

    const res = await POST(uploadRequest({
      files: [
        { fileName: 'a.mp4', contentType: 'video/mp4', fileSize: 1000 },
        { fileName: 'dupe.mp4', contentType: 'video/mp4', fileSize: 1000 },
      ],
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.results).toHaveLength(2)
    expect(body.results[0].id).toBe('item-1')
    expect(body.results[1].error).toBe('Bu dosya zaten kütüphanenizde mevcut')
  })
})
