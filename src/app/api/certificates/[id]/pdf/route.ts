import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { jsPDF } from 'jspdf'
import { logActivity } from '@/lib/activity-logger'
import { drawCertificatePage, type CertDrawData } from '@/lib/pdf/cert-design'
import { applyTurkishFont } from '@/lib/pdf/helpers/font'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'

function formatDateTR(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationId: true,
            organization: { select: { name: true, logoUrl: true } },
          },
        },
        training: {
          select: { title: true, category: true, organizationId: true },
        },
        attempt: {
          select: { postExamScore: true, attemptNumber: true },
        },
      },
    })

    if (!certificate) {
      return errorResponse('Sertifika bulunamadı', 404)
    }

    if (dbUser.role === 'staff' && certificate.userId !== dbUser.id) {
      return errorResponse('Bu sertifikaya erişim yetkiniz yok', 403)
    }
    if (
      dbUser.role === 'admin' &&
      certificate.training.organizationId !== organizationId
    ) {
      return errorResponse('Bu sertifikaya erişim yetkiniz yok', 403)
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    await applyTurkishFont(doc)

    const logoDataUrl = await resolveOrgLogoDataUrl(certificate.user.organization?.logoUrl)

    const score = certificate.attempt.postExamScore
      ? Number(certificate.attempt.postExamScore)
      : null

    const data: CertDrawData = {
      fullName: `${certificate.user.firstName} ${certificate.user.lastName}`,
      trainingTitle: certificate.training.title,
      organizationName: certificate.user.organization?.name ?? '',
      organizationLogoDataUrl: logoDataUrl,
      issuedAtText: formatDateTR(certificate.issuedAt),
      expiresAtText: certificate.expiresAt ? formatDateTR(certificate.expiresAt) : null,
      isExpired: !!certificate.expiresAt && certificate.expiresAt < new Date(),
      isRevoked: !!certificate.revokedAt,
      certificateCode: certificate.certificateCode,
      score,
    }

    drawCertificatePage(doc, data)

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const fileName = `sertifika-${certificate.certificateCode}.pdf`

    void logActivity({
      userId: dbUser.id,
      organizationId: certificate.user.organizationId ?? '',
      action: 'certificate_download',
      resourceType: 'certificate',
      resourceId: certificate.id,
      resourceTitle: certificate.training.title,
      metadata: { certificateCode: certificate.certificateCode },
    })

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    logger.error('Certificate PDF', 'PDF oluşturulamadı', err)
    return errorResponse('PDF oluşturulamadı', 500)
  }
}, { requireOrganization: true })
