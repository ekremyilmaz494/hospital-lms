import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/admin/trainings/[id]/transcripts — transkript durum endpoint'i.
 *
 * Kritik davranışlar:
 *   1. Draft videolar (TrainingVideo satırı yok) draftData.videos'tan gelir
 *      ve durumları S3'ten (resolveTranscriptStatus) çözülür.
 *   2. Published satırda DB cache'i (transcriptStatus) varsa S3 HEAD atlanır.
 *   3. Org izolasyonu: yabancı org'un eğitimi 404.
 *   4. GET'te Cache-Control zorunlu (CLAUDE.md perf kuralı).
 */

const { prismaMock, transcriptsMock } = vi.hoisted(() => ({
  prismaMock: {
    training: { findFirst: vi.fn() },
    trainingVideo: { findMany: vi.fn() },
  },
  transcriptsMock: {
    resolveTranscriptStatus: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/transcripts', () => transcriptsMock)
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P,>(handler: (ctx: {
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

import { GET } from '../route'

function getRequest(): Request {
  return new Request('http://localhost/api/admin/trainings/training-1/transcripts')
}

const callGet = () => GET(getRequest(), { params: Promise.resolve({ id: 'training-1' }) })

describe('GET /api/admin/trainings/[id]/transcripts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.training.findFirst.mockResolvedValue({ id: 'training-1', draftData: null })
    prismaMock.trainingVideo.findMany.mockResolvedValue([])
    transcriptsMock.resolveTranscriptStatus.mockResolvedValue({
      status: 'none',
      transcriptKey: null,
      sizeBytes: null,
    })
  })

  it("yabancı org'un eğitimi 404 (org izolasyonu)", async () => {
    prismaMock.training.findFirst.mockResolvedValue(null)
    const res = await callGet()
    expect(res.status).toBe(404)
    // Guard: findFirst organizationId filtresiyle çağrılmış olmalı.
    const where = prismaMock.training.findFirst.mock.calls[0][0].where as Record<string, unknown>
    expect(where.organizationId).toBe('org-1')
  })

  it('Cache-Control başlığı zorunlu (perf kuralı)', async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('private')
    expect(res.headers.get('Cache-Control')).toContain('max-age=10')
  })

  it("published satırda DB cache'i (completed) varsa S3'e gidilmez", async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValue([
      {
        title: 'El Hijyeni',
        videoKey: 'videos/org-1/training-1/u-1_720p.mp4',
        transcriptKey: 'transcripts/org-1/training-1/u-1.txt',
        transcriptStatus: 'completed',
      },
    ])

    const res = await callGet()
    const body = (await res.json()) as { transcripts: Array<Record<string, unknown>> }

    expect(body.transcripts).toHaveLength(1)
    expect(body.transcripts[0]).toMatchObject({
      status: 'completed',
      transcriptKey: 'transcripts/org-1/training-1/u-1.txt',
    })
    expect(transcriptsMock.resolveTranscriptStatus).not.toHaveBeenCalled()
  })

  it("DB cache'i yoksa durum S3'ten çözülür", async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValue([
      {
        title: 'Sterilizasyon',
        videoKey: 'videos/org-1/training-1/u-2_720p.mp4',
        transcriptKey: null,
        transcriptStatus: null,
      },
    ])
    transcriptsMock.resolveTranscriptStatus.mockResolvedValue({
      status: 'processing',
      transcriptKey: null,
      sizeBytes: null,
    })

    const res = await callGet()
    const body = (await res.json()) as { transcripts: Array<Record<string, unknown>> }

    expect(transcriptsMock.resolveTranscriptStatus).toHaveBeenCalledWith(
      'videos/org-1/training-1/u-2_720p.mp4',
    )
    expect(body.transcripts[0]).toMatchObject({ status: 'processing' })
  })

  it('draft videoları (satırsız) draftData.videos üzerinden dahil edilir', async () => {
    prismaMock.training.findFirst.mockResolvedValue({
      id: 'training-1',
      draftData: {
        videos: [
          { title: 'Draft Video', url: 'videos/org-1/drafts/u-3.mp4', contentType: 'video' },
          { title: 'Draft PDF', url: 'documents/org-1/drafts/d-1.pdf', contentType: 'pdf' },
        ],
      },
    })
    transcriptsMock.resolveTranscriptStatus.mockResolvedValue({
      status: 'completed',
      transcriptKey: 'transcripts/org-1/drafts/u-3.txt',
      sizeBytes: 1234,
    })

    const res = await callGet()
    const body = (await res.json()) as { transcripts: Array<Record<string, unknown>> }

    // PDF içerik dahil edilmez, yalnız video.
    expect(body.transcripts).toHaveLength(1)
    expect(body.transcripts[0]).toMatchObject({
      videoKey: 'videos/org-1/drafts/u-3.mp4',
      title: 'Draft Video',
      status: 'completed',
      transcriptKey: 'transcripts/org-1/drafts/u-3.txt',
    })
  })

  it('aynı videoKey hem satırda hem draftData\'da varsa tekilleştirilir', async () => {
    prismaMock.trainingVideo.findMany.mockResolvedValue([
      {
        title: 'Video',
        videoKey: 'videos/org-1/drafts/u-4.mp4',
        transcriptKey: null,
        transcriptStatus: 'failed',
      },
    ])
    prismaMock.training.findFirst.mockResolvedValue({
      id: 'training-1',
      draftData: {
        videos: [{ title: 'Video', url: 'videos/org-1/drafts/u-4.mp4', contentType: 'video' }],
      },
    })

    const res = await callGet()
    const body = (await res.json()) as { transcripts: Array<Record<string, unknown>> }

    expect(body.transcripts).toHaveLength(1)
    expect(body.transcripts[0]).toMatchObject({ status: 'failed' })
  })
})
