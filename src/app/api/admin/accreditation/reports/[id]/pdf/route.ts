import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { buildReportContext } from '@/lib/pdf/aggregate'
import { buildAccreditationPDF } from '@/lib/pdf/build-report'

/**
 * GET /api/admin/accreditation/reports/[id]/pdf
 *
 * Profesyonel akreditasyon raporu PDF'i — kapak sayfası + yönetici özeti +
 * standart tablosu + departman analizi + eksik eğitim listesi + aksiyon planı.
 *
 * Tüm veri toplama `buildReportContext`, tüm render `buildAccreditationPDF` içinde.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const ctx = await buildReportContext(id, organizationId)
  if (!ctx) return errorResponse('Rapor bulunamadı', 404)

  const doc = buildAccreditationPDF(ctx)
  const pdfBuffer = doc.output('arraybuffer')

  const safeTitle = ctx.report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'akreditasyon'

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}, { requireOrganization: true })
