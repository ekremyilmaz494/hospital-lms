import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * resolveTrainingVideoUrl() sözleşmesinin koruma altına alındığı testler.
 * Bu helper'ın davranışı CLAUDE.md "Video URL Kuralı"nın temelidir:
 *
 *   1. videoKey varsa → getStreamUrl() signed URL'i
 *   2. Legacy /uploads/... → raw videoUrl
 *   3. getStreamUrl throw → '' (raw v.videoUrl'ye fallback ASLA)
 *   4. videoKey null + videoUrl raw CloudFront URL → '' (zehirli veri pass-through ASLA)
 */

const { getStreamUrlMock, loggerMock } = vi.hoisted(() => ({
  getStreamUrlMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/s3', () => ({ getStreamUrl: getStreamUrlMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

import { resolveTrainingVideoUrl, resolveTrainingDocumentUrl } from '../training-video-url'

describe('resolveTrainingVideoUrl — Video URL Kuralı sözleşmesi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('videoKey varsa → getStreamUrl() signed URL döner', async () => {
    getStreamUrlMock.mockResolvedValue(
      'https://cdn.example.com/videos/org/training/v.mp4?Signature=abc&Expires=123',
    )

    const url = await resolveTrainingVideoUrl({
      id: 'v1',
      videoKey: 'videos/org/training/v.mp4',
      videoUrl: '',
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toContain('Signature=')
    expect(getStreamUrlMock).toHaveBeenCalledWith('videos/org/training/v.mp4')
  })

  it('legacy /uploads path → raw videoUrl pass-through (eski S3-öncesi kayıtlar)', async () => {
    const url = await resolveTrainingVideoUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: '/uploads/legacy/video.mp4',
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toBe('/uploads/legacy/video.mp4')
    expect(getStreamUrlMock).not.toHaveBeenCalled()
  })

  it('KRİTİK: getStreamUrl throw → \'\' döner, raw videoUrl\'ye fallback YAPMAZ', async () => {
    getStreamUrlMock.mockRejectedValue(new Error('CF sign failed'))

    const url = await resolveTrainingVideoUrl({
      id: 'v1',
      videoKey: 'videos/org/training/v.mp4',
      // Bu zehirli URL (raw CloudFront, unsigned) DB'de varsa fallback olarak DÖNMEMELİ
      videoUrl: 'https://cdn.example.com/videos/org/training/v.mp4',
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toBe('')
    expect(url).not.toContain('cloudfront')
    expect(url).not.toContain('cdn.example')
    expect(loggerMock.error).toHaveBeenCalled()
  })

  it('KRİTİK: videoKey null + zehirli raw videoUrl → \'\' (pass-through ASLA)', async () => {
    const url = await resolveTrainingVideoUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: 'https://cdn.example.com/videos/org/training/v.mp4',
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toBe('')
    expect(getStreamUrlMock).not.toHaveBeenCalled()
  })

  it('hem videoKey hem videoUrl null → \'\'', async () => {
    const url = await resolveTrainingVideoUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: null,
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toBe('')
  })
})

describe('resolveTrainingDocumentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('documentKey varsa → signed URL döner', async () => {
    getStreamUrlMock.mockResolvedValue('https://cdn/doc.pdf?Signature=xyz')

    const url = await resolveTrainingDocumentUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: null,
      documentKey: 'documents/org/training/doc.pdf',
      contentType: 'pdf',
    })

    expect(url).toContain('Signature=')
  })

  it('documentKey null → \'\'', async () => {
    const url = await resolveTrainingDocumentUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: null,
      documentKey: null,
      contentType: 'video',
    })

    expect(url).toBe('')
    expect(getStreamUrlMock).not.toHaveBeenCalled()
  })

  it('getStreamUrl throw → \'\' + logger.error', async () => {
    getStreamUrlMock.mockRejectedValue(new Error('boom'))

    const url = await resolveTrainingDocumentUrl({
      id: 'v1',
      videoKey: null,
      videoUrl: null,
      documentKey: 'documents/org/training/doc.pdf',
      contentType: 'pdf',
    })

    expect(url).toBe('')
    expect(loggerMock.error).toHaveBeenCalled()
  })
})
