import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { certificate: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Ağır jsPDF/font/QR üretimini route testine sokma — builder'ı mock'la.
vi.mock('@/lib/pdf/build-certificate-pdf', () => ({
  buildCertificatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-FAKE')),
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { buildCertificatePdfBuffer } from '@/lib/pdf/build-certificate-pdf'

const mockFindUnique = vi.mocked(prisma.certificate.findUnique)
const mockRateLimit = vi.mocked(checkRateLimit)
const mockBuild = vi.mocked(buildCertificatePdfBuffer)

function callGET(code: string, query = '') {
  const request = new NextRequest(`http://localhost/api/certificates/verify/${code}/pdf${query}`)
  return GET(request, { params: Promise.resolve({ code }) })
}

const validCert = {
  issuedAt: new Date('2025-06-15T00:00:00Z'),
  expiresAt: null,
  revokedAt: null,
  certificateCode: 'VALID-CODE-12345678',
  user: { firstName: 'Mehmet', lastName: 'Yilmaz', organization: { name: 'Ankara Hastanesi', logoUrl: null } },
  training: { title: 'Temel Hijyen' },
  attempt: { postExamScore: 95 },
  scormAttempt: null,
}

describe('GET /api/certificates/verify/[code]/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(true)
    mockBuild.mockResolvedValue(Buffer.from('%PDF-FAKE'))
  })

  it('rate limit aşılınca 429 döner, DB ve PDF üretimi çalışmaz', async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await callGET('VALID-CODE-12345678')
    expect(res.status).toBe(429)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockBuild).not.toHaveBeenCalled()
  })

  it('geçersiz kod formatında 400 döner', async () => {
    const res = await callGET('BAD!CODE')
    expect(res.status).toBe(400)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('sertifika yoksa 404 döner', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await callGET('VALID-CODE-12345678')
    expect(res.status).toBe(404)
    expect(mockBuild).not.toHaveBeenCalled()
  })

  it('varsayılan olarak inline PDF döner ve builder doğru alanlarla çağrılır', async () => {
    mockFindUnique.mockResolvedValue(validCert as never)
    const res = await callGET('VALID-CODE-12345678')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('inline')
    expect(mockBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Mehmet',
        lastName: 'Yilmaz',
        trainingTitle: 'Temel Hijyen',
        organizationName: 'Ankara Hastanesi',
        certificateCode: 'VALID-CODE-12345678',
        score: 95,
      }),
    )
  })

  it('?download=1 ile attachment döner', async () => {
    mockFindUnique.mockResolvedValue(validCert as never)
    const res = await callGET('VALID-CODE-12345678', '?download=1')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('iptal edilmiş sertifika da PDF olarak indirilebilir (İPTAL damgası PDF’de)', async () => {
    mockFindUnique.mockResolvedValue({ ...validCert, revokedAt: new Date('2025-10-01T00:00:00Z') } as never)
    const res = await callGET('VALID-CODE-12345678')
    expect(res.status).toBe(200)
    expect(mockBuild).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }))
  })
})
