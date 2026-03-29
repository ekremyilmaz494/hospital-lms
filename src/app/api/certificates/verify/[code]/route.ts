import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

/** Mask name: first 2 chars + "***" */
function maskName(name: string): string {
  if (name.length <= 2) return name + '***'
  return name.slice(0, 2) + '***'
}

/** Valid certificate code: alphanumeric + dashes, 8-64 chars */
const CERT_CODE_REGEX = /^[A-Za-z0-9\-]{8,64}$/

/** GET /api/certificates/verify/[code] — Public certificate verification */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!CERT_CODE_REGEX.test(code)) {
    return errorResponse('Geçersiz sertifika kodu formatı', 400)
  }

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { certificateCode: code },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        training: {
          select: { title: true, organizationId: true },
        },
      },
    })

    if (!certificate) {
      return errorResponse('Sertifika bulunamadı', 404)
    }

    // Get organization name
    const org = await prisma.organization.findUnique({
      where: { id: certificate.training.organizationId },
      select: { name: true },
    })

    const isExpired = certificate.expiresAt
      ? new Date(certificate.expiresAt) < new Date()
      : false

    const maskedFirst = maskName(certificate.user.firstName)
    const maskedLast = maskName(certificate.user.lastName)

    return jsonResponse({
      isValid: !isExpired,
      holderName: `${maskedFirst} ${maskedLast}`,
      trainingTitle: certificate.training.title,
      issuedAt: certificate.issuedAt.toISOString(),
      expiresAt: certificate.expiresAt?.toISOString() ?? null,
      organizationName: org?.name ?? null,
    })
  } catch (err) {
    logger.error('CertVerify', 'Sertifika dogrulama hatasi', err)
    return errorResponse('Doğrulama sırasında bir hata oluştu', 500)
  }
}
