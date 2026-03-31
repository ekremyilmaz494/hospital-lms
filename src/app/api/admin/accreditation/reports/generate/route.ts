import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { generateAccreditationReport } from '@/lib/accreditation'
import type { StandardBody } from '@/lib/accreditation'
import { z } from 'zod/v4'

const generateSchema = z.object({
  standardBody: z.enum(['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})

/** POST /api/admin/accreditation/reports/generate */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri')

  const { standardBody, periodStart, periodEnd } = parsed.data
  const orgId = dbUser!.organizationId!
  const userId = dbUser!.id

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (start >= end) return errorResponse('Dönem başlangıcı bitiş tarihinden önce olmalıdır')

  try {
    const report = await generateAccreditationReport({
      organizationId: orgId,
      standardBody: standardBody as StandardBody,
      periodStart: start,
      periodEnd: end,
      generatedBy: userId,
    })

    await createAuditLog({
      userId,
      organizationId: orgId,
      action: 'accreditation_report_generated',
      resource: 'accreditation_report',
      resourceId: report.reportId,
      details: { standardBody, overallComplianceRate: report.overallComplianceRate },
    })

    return jsonResponse({ report }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rapor oluşturulamadı'
    return errorResponse(message, 500)
  }
}
