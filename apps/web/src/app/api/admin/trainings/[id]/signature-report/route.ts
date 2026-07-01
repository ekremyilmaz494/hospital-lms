import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { buildEgitimKatilimFormPdf } from '@/lib/pdf/egitim-katilim-form'

/**
 * GET /api/admin/trainings/[id]/signature-report
 * Eğitim Katılım ve İmza Formu (SKS) — eğitime atanan personelin katılım/tamamlama durumunu,
 * puanını ve (varsa) ıslak/dijital imza kaydını belgeler. org-scoped: başka kurumun eğitimi export edilemez.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  try {
    const training = await prisma.training.findFirst({
      where: { id, organizationId },
      select: {
        title: true,
        category: true,
        startDate: true,
        endDate: true,
        organization: { select: { name: true, logoUrl: true } },
        assignments: {
          select: {
            status: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                title: true,
                departmentRel: { select: { name: true } },
              },
            },
            examAttempts: {
              where: { isPassed: true },
              orderBy: { postExamCompletedAt: 'desc' },
              take: 1,
              select: {
                postExamCompletedAt: true,
                postExamScore: true,
                signedAt: true,
                signatureData: true,
                signatureMethod: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    })

    if (!training) return errorResponse('Eğitim bulunamadı', 404)

    const orgName = training.organization?.name ?? 'Kurum'
    const logoDataUrl = await resolveOrgLogoDataUrl(training.organization?.logoUrl)

    const roleDeptOf = (u: { title: string | null; departmentRel: { name: string } | null }) =>
      [u.title, u.departmentRel?.name].filter(Boolean).join(' / ')

    const participants = training.assignments.map(a => {
      const attempt = a.examAttempts[0]
      return {
        fullName: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
        roleDept: roleDeptOf(a.user),
        status: a.status,
        completedAt: attempt?.postExamCompletedAt ?? null,
        score: attempt?.postExamScore != null ? Number(attempt.postExamScore) : null,
        signedAt: attempt?.signedAt ?? null,
        signatureMethod: attempt?.signatureMethod ?? null,
      }
    })

    const signatures = training.assignments
      .map(a => {
        const attempt = a.examAttempts[0]
        if (!attempt?.signatureData || attempt.signatureMethod !== 'canvas') return null
        return {
          fullName: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
          roleDept: roleDeptOf(a.user),
          signedAt: attempt.signedAt,
          data: attempt.signatureData,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    const pdf = await buildEgitimKatilimFormPdf({
      trainingTitle: training.title,
      category: training.category,
      startDate: training.startDate,
      endDate: training.endDate,
      organizationName: orgName,
      logoDataUrl,
      docRef: id.slice(0, 8).toUpperCase(),
      participants,
      signatures,
    })

    const safeName = training.title
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/gi, '_').toLowerCase()

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}_katilim_imza_formu.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('SignatureReportPDF', 'Katılım ve imza formu oluşturulamadı', err)
    return errorResponse('Katılım formu oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
