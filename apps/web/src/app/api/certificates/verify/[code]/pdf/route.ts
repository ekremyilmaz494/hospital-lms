import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { buildCertificatePdfBuffer } from '@/lib/pdf/build-certificate-pdf'

/** Public endpoint — istemci IP'si (kod enumerasyonuna karşı rate-limit anahtarı). */
function ipFromRequest(req: NextRequest): string {
  return req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown'
}

/** Valid certificate code: alphanumeric + dashes, 8-64 chars (verify route ile aynı). */
const CERT_CODE_REGEX = /^[A-Za-z0-9\-]{8,64}$/

/**
 * GET /api/certificates/verify/[code]/pdf — Public sertifika PDF'i (koda göre).
 *
 * Doğrulama sayfasındaki "Görüntüle / İndir" butonları bunu kullanır. Auth YOK:
 * kod bir yetenek (capability) token'ıdır (128-bit rastgele, tahmin edilemez).
 * PDF tam ismi gösterir; JSON doğrulama endpoint'i ismi maskeler — bu uç bilinçli
 * olarak tam sertifikayı verir (denetçi zaten sertifikayı elinde tutan kişiyi doğrular).
 * PDF üretimi JSON'dan ağır olduğu için rate-limit daha sıkı: 20 istek / 10 dk.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = ipFromRequest(request)
  if (!(await checkRateLimit(`cert-verify-pdf:ip:${ip}`, 20, 600))) {
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
        certificateCode: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            organization: { select: { name: true, logoUrl: true } },
          },
        },
        training: { select: { title: true } },
        attempt: { select: { postExamScore: true } },
        // Saf SCORM sertifikasında ExamAttempt yok; skor ScormAttempt'ten gelir.
        scormAttempt: { select: { score: true } },
      },
    })

    if (!certificate) {
      return errorResponse('Sertifika bulunamadı', 404)
    }

    const score = certificate.attempt?.postExamScore
      ? Number(certificate.attempt.postExamScore)
      : (certificate.scormAttempt?.score ?? null)

    const pdfBuffer = await buildCertificatePdfBuffer({
      firstName: certificate.user.firstName,
      lastName: certificate.user.lastName,
      trainingTitle: certificate.training.title,
      organizationName: certificate.user.organization?.name ?? '',
      organizationLogoUrl: certificate.user.organization?.logoUrl ?? null,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      revokedAt: certificate.revokedAt,
      certificateCode: certificate.certificateCode,
      score,
    })

    // ?download=1 → indir (attachment), aksi halde tarayıcıda göster (inline).
    const download = new URL(request.url).searchParams.get('download') === '1'
    const disposition = download ? 'attachment' : 'inline'

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="sertifika-${certificate.certificateCode}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        // Public doğrulama PDF'i — kısa cache, hızlı revoke/expiry yansıması.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    logger.error('Certificate verify PDF', 'PDF oluşturulamadı', err)
    return errorResponse('PDF oluşturulamadı', 500)
  }
}
