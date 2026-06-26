import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'
import { buildCertificatePdfBuffer } from '@/lib/pdf/build-certificate-pdf'

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
        // D1b — saf SCORM sertifikasında ExamAttempt yok; skor ScormAttempt'ten gelir.
        scormAttempt: { select: { score: true } },
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
