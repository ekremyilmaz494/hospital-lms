import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * resolveContentLibraryUrl() sözleşmesi — CLAUDE.md "Video URL Kuralı" gereği:
 *
 *  1. s3Key varsa → getStreamUrl() signed URL'i döner
 *  2. s3Key null → '' (boş string)
 *  3. getStreamUrl throw → '' + logger.error (raw URL'ye fallback ASLA)
 */

const { getStreamUrlMock, loggerMock } = vi.hoisted(() => ({
  getStreamUrlMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/s3', () => ({ getStreamUrl: getStreamUrlMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

import { resolveContentLibraryUrl } from '../content-library-url'

describe('resolveContentLibraryUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('s3Key varsa → getStreamUrl signed URL döner', async () => {
    getStreamUrlMock.mockResolvedValue(
      'https://cdn.example.com/library/org/file.mp4?Signature=abc&Expires=123',
    )

    const url = await resolveContentLibraryUrl({
      id: 'c1',
      s3Key: 'library/org/file.mp4',
      contentType: 'video',
    })

    expect(url).toContain('Signature=')
    expect(getStreamUrlMock).toHaveBeenCalledWith('library/org/file.mp4')
  })

  it('s3Key null → \'\' (boş string), getStreamUrl çağrılmaz', async () => {
    const url = await resolveContentLibraryUrl({
      id: 'c1',
      s3Key: null,
      contentType: 'video',
    })

    expect(url).toBe('')
    expect(getStreamUrlMock).not.toHaveBeenCalled()
  })

  it('KRİTİK: getStreamUrl throw → \'\' + logger.error', async () => {
    getStreamUrlMock.mockRejectedValue(new Error('CF sign failed'))

    const url = await resolveContentLibraryUrl({
      id: 'c1',
      s3Key: 'library/org/file.mp4',
      contentType: 'video',
    })

    expect(url).toBe('')
    expect(loggerMock.error).toHaveBeenCalled()
  })

  it('PDF/audio gibi farklı contentType\'lar için de aynı flow çalışır', async () => {
    getStreamUrlMock.mockResolvedValue('https://cdn/doc.pdf?Signature=xyz')

    const url = await resolveContentLibraryUrl({
      id: 'c2',
      s3Key: 'documents/org/file.pdf',
      contentType: 'pdf',
    })

    expect(url).toContain('Signature=')
    expect(getStreamUrlMock).toHaveBeenCalledWith('documents/org/file.pdf')
  })
})
