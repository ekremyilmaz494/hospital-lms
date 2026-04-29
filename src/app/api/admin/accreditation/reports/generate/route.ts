import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { generateAccreditationReport } from '@/lib/accreditation'
import type { StandardBody } from '@/lib/accreditation'
import { z } from 'zod/v4'

const generateSchema = z.object({
  standardBody: z.enum(['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})

/** POST /api/admin/accreditation/reports/generate */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri')

  const { standardBody, periodStart, periodEnd } = parsed.data
  const userId = dbUser.id

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (start >= end) return errorResponse('Dönem başlangıcı bitiş tarihinden önce olmalıdır')

  try {
    const report = await generateAccreditationReport({
      organizationId,
      standardBody: standardBody as StandardBody,
      periodStart: start,
      periodEnd: end,
      generatedBy: userId,
    })

    await audit({
      action: 'accreditation_report_generated',
      entityType: 'accreditation_report',
      entityId: report.reportId,
      newData: { standardBody, overallComplianceRate: report.overallComplianceRate },
    })

    return jsonResponse({ report }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rapor oluşturulamadı'
    return errorResponse(message, 500)
  }
}, { requireOrganization: true })
