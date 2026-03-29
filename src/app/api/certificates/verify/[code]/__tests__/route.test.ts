import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Must import after mocks are set up
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const mockCertificateFindUnique = vi.mocked(prisma.certificate.findUnique)
const mockOrganizationFindUnique = vi.mocked(prisma.organization.findUnique)

function createRequest(code: string) {
  const request = new NextRequest(`http://localhost/api/certificates/verify/${code}`)
  return request
}

function callGET(code: string) {
  const request = createRequest(code)
  return GET(request, { params: Promise.resolve({ code }) })
}

describe('GET /api/certificates/verify/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for certificate code with special characters', async () => {
    const response = await callGET('INVALID!@#$CODE')
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Geçersiz sertifika kodu formatı')
  })

  it('returns 400 for certificate code that is too short', async () => {
    const response = await callGET('AB')
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Geçersiz sertifika kodu formatı')
  })

  it('returns 404 when certificate not found', async () => {
    mockCertificateFindUnique.mockResolvedValue(null)

    const response = await callGET('VALID-CODE-12345678')
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Sertifika bulunamadı')
    expect(mockCertificateFindUnique).toHaveBeenCalledWith({
      where: { certificateCode: 'VALID-CODE-12345678' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        training: { select: { title: true, organizationId: true } },
      },
    })
  })

  it('returns valid certificate data with masked name', async () => {
    const futureDate = new Date(Date.now() + 365 * 86400000)

    mockCertificateFindUnique.mockResolvedValue({
      id: 'cert-1',
      certificateCode: 'VALID-CODE-12345678',
      issuedAt: new Date('2025-06-15T00:00:00Z'),
      expiresAt: futureDate,
      user: { firstName: 'Mehmet', lastName: 'Yilmaz' },
      training: { title: 'Temel Hijyen Egitimi', organizationId: 'org-1' },
    } as never)

    mockOrganizationFindUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Ankara Sehir Hastanesi',
    } as never)

    const response = await callGET('VALID-CODE-12345678')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isValid).toBe(true)
    expect(data.holderName).toBe('Me*** Yi***')
    expect(data.trainingTitle).toBe('Temel Hijyen Egitimi')
    expect(data.organizationName).toBe('Ankara Sehir Hastanesi')
    expect(data.issuedAt).toBe('2025-06-15T00:00:00.000Z')
    expect(data.expiresAt).toBe(futureDate.toISOString())
  })

  it('returns isValid=false for expired certificate', async () => {
    const pastDate = new Date('2024-01-01T00:00:00Z')

    mockCertificateFindUnique.mockResolvedValue({
      id: 'cert-2',
      certificateCode: 'EXPIRED-CODE-1234',
      issuedAt: new Date('2023-01-01T00:00:00Z'),
      expiresAt: pastDate,
      user: { firstName: 'Ayse', lastName: 'Demir' },
      training: { title: 'Yangin Guvenligi', organizationId: 'org-2' },
    } as never)

    mockOrganizationFindUnique.mockResolvedValue({
      id: 'org-2',
      name: 'Istanbul Hastanesi',
    } as never)

    const response = await callGET('EXPIRED-CODE-1234')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isValid).toBe(false)
    expect(data.holderName).toBe('Ay*** De***')
  })

  it('returns isValid=true for non-expired certificate', async () => {
    const futureDate = new Date(Date.now() + 180 * 86400000)

    mockCertificateFindUnique.mockResolvedValue({
      id: 'cert-3',
      certificateCode: 'ACTIVE-CODE-5678',
      issuedAt: new Date('2025-09-01T00:00:00Z'),
      expiresAt: futureDate,
      user: { firstName: 'Ali', lastName: 'Kara' },
      training: { title: 'Ilk Yardim', organizationId: 'org-3' },
    } as never)

    mockOrganizationFindUnique.mockResolvedValue({
      id: 'org-3',
      name: 'Izmir Devlet Hastanesi',
    } as never)

    const response = await callGET('ACTIVE-CODE-5678')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isValid).toBe(true)
    expect(data.expiresAt).toBe(futureDate.toISOString())
  })
})
