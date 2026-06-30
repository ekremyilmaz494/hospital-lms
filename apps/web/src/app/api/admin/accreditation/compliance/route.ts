import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getCurrentCompliance, VALID_STANDARD_BODIES } from '@/lib/accreditation'
import type { StandardBody } from '@/lib/accreditation'

function parseDateParam(value: string | null, field: string): Date | null | Response {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return errorResponse(`${field} gecersiz tarih`, 400)
  return date
}

/** GET /api/admin/accreditation/compliance?standardBody=JCI&periodStart=...&periodEnd=... */
export const GET = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const standardBodyParam = searchParams.get('standardBody')

  if (!standardBodyParam || !VALID_STANDARD_BODIES.includes(standardBodyParam as StandardBody)) {
    return errorResponse('Gecerli bir standart kurulusu belirtin: JCI, ISO_9001, ISO_15189, TJC, OSHA, SKS')
  }

  const periodStartParsed = parseDateParam(searchParams.get('periodStart'), 'Donem baslangici')
  if (periodStartParsed instanceof Response) return periodStartParsed
  const periodEndParsed = parseDateParam(searchParams.get('periodEnd'), 'Donem bitisi')
  if (periodEndParsed instanceof Response) return periodEndParsed

  if ((periodStartParsed && !periodEndParsed) || (!periodStartParsed && periodEndParsed)) {
    return errorResponse('Donem baslangici ve bitisi birlikte gonderilmelidir', 400)
  }
  if (periodStartParsed && periodEndParsed && periodStartParsed >= periodEndParsed) {
    return errorResponse('Donem baslangici bitis tarihinden once olmalidir', 400)
  }

  try {
    const compliance = await getCurrentCompliance({
      organizationId,
      standardBody: standardBodyParam as StandardBody,
      requestedBy: dbUser.id,
      ...(periodStartParsed && periodEndParsed ? { periodStart: periodStartParsed, periodEnd: periodEndParsed } : {}),
    })

    return jsonResponse({ compliance }, 200, { 'Cache-Control': 'private, no-store' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Uyumluluk hesaplanamadi'
    return errorResponse(message, 500)
  }
}, { requireOrganization: true })