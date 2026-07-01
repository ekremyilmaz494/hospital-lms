import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { buildTranscriptPdf } from '@/lib/pdf/staff-transcript'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

/**
 * GET /api/staff/transcript/pdf
 *
 * Personelin tamamlanmış tüm eğitimlerini listeleyen transkript PDF'i üretir.
 * İndirme olarak döner (Content-Disposition: attachment).
 */
export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  try {
    const [user, certificates, org] = await Promise.all([
      prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { firstName: true, lastName: true },
      }),
      prisma.certificate.findMany({
        where: {
          userId: dbUser.id,
          revokedAt: null,
          training: { organizationId },
        },
        select: {
          certificateCode: true,
          issuedAt: true,
          training: { select: { title: true, category: true } },
          attempt: { select: { postExamScore: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, logoUrl: true },
      }),
    ])

    const fullName = user ? `${user.firstName} ${user.lastName}` : dbUser.id
    const orgName = org?.name ?? ''
    const logoDataUrl = await resolveOrgLogoDataUrl(org?.logoUrl)
    const generatedAt = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const entries = certificates.map(c => ({
      trainingTitle: c.training.title,
      category: c.training.category ?? '',
      issuedAt: c.issuedAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }),
      score: c.attempt?.postExamScore ? Number(c.attempt.postExamScore) : null,
      certificateCode: c.certificateCode,
    }))

    const pdfBuffer = await buildTranscriptPdf({ fullName, organizationName: orgName, generatedAt, logoDataUrl, entries })

    const safeName = fullName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ ]/g, '').trim()
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}-transkript.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error('StaffTranscriptPDF GET', 'PDF üretilemedi', { err, userId: dbUser.id })
    return errorResponse('Transkript oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
