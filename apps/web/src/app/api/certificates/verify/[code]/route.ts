import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

/** Mask name: first 2 chars + "***" */
function maskName(name: string): string {
  if (name.length <= 2) return name + '***'
  return name.slice(0, 2) + '***'
}

/** Public endpoint — istemci IP'si (kod enumerasyonuna karşı rate-limit anahtarı). */
function ipFromRequest(req: NextRequest): string {
  return req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown'
}

/** Valid certificate code: alphanumeric + dashes, 8-64 chars */
const CERT_CODE_REGEX = /^[A-Za-z0-9\-]{8,64}$/

/** GET /api/certificates/verify/[code] — Public certificate verification */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  // Public + auth'suz → kod enumerasyonunu engellemek için IP-bazlı rate-limit.
  // 60 istek / 10 dk: meşru toplu doğrulamayı boğmaz, brute-force'u kırar.
  const ip = ipFromRequest(request)
  if (!(await checkRateLimit(`cert-verify:ip:${ip}`, 60, 600))) {
    return errorResponse('Çok fazla istek gönderdiniz. Lütfen biraz sonra tekrar deneyin.', 429)
  }

  const { code } = await params

  if (!CERT_CODE_REGEX.test(code)) {
    return errorResponse('Geçersiz sertifika kodu formatı', 400)
  }

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { certificateCode: code },
      select: {
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: { firstName: true, lastName: true },
        },
        training: {
          // Tek sorguda org adını da çek — ayrı organization.findUnique gereksiz.
          select: { title: true, organization: { select: { name: true } } },
        },
      },
    })

    if (!certificate) {
      return errorResponse('Sertifika bulunamadı', 404)
    }

    const isExpired = certificate.expiresAt
      ? new Date(certificate.expiresAt) < new Date()
      : false
    const isRevoked = !!certificate.revokedAt

    const maskedFirst = maskName(certificate.user.firstName)
    const maskedLast = maskName(certificate.user.lastName)

    return jsonResponse({
      isValid: !isExpired && !isRevoked,
      isRevoked,
      holderName: `${maskedFirst} ${maskedLast}`,
      trainingTitle: certificate.training.title,
      issuedAt: certificate.issuedAt.toISOString(),
      expiresAt: certificate.expiresAt?.toISOString() ?? null,
      revokedAt: certificate.revokedAt?.toISOString() ?? null,
      organizationName: certificate.training.organization?.name ?? null,
    }, 200, {
      // Public sertifika doğrulama — 1 dk cache, hızlı revoke yansır.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    })
  } catch (err) {
    logger.error('CertVerify', 'Sertifika dogrulama hatasi', err)
    return errorResponse('Doğrulama sırasında bir hata oluştu', 500)
  }
}
