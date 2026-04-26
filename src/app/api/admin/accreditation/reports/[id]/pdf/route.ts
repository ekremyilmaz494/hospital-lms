import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
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
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const ctx = await buildReportContext(id, orgId)
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
}
