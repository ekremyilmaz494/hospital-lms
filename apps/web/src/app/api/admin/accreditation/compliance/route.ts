import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getCurrentCompliance } from '@/lib/accreditation'
import type { StandardBody } from '@/lib/accreditation'

const VALID_BODIES: StandardBody[] = ['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA']

/** GET /api/admin/accreditation/compliance?standardBody=JCI */
export const GET = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const standardBodyParam = searchParams.get('standardBody')

  if (!standardBodyParam || !VALID_BODIES.includes(standardBodyParam as StandardBody)) {
    return errorResponse('Geçerli bir standart kuruluşu belirtin: JCI, ISO_9001, ISO_15189, TJC, OSHA')
  }

  try {
    const compliance = await getCurrentCompliance({
      organizationId,
      standardBody: standardBodyParam as StandardBody,
      requestedBy: dbUser.id,
    })

    return jsonResponse({ compliance }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Uyumluluk hesaplanamadı'
    return errorResponse(message, 500)
  }
}, { requireOrganization: true })
