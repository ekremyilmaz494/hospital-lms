/**
 * GET /api/admin/training-periods/active — UI dropdown / kontekst için aktif dönem.
 * Aktif dönem yoksa servis ApiError(409) döner ("Aktif eğitim dönemi bulunamadı...").
 */

import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse } from '@/lib/api-helpers'
import { getActivePeriod } from '@/lib/training-periods'

export const GET = withAdminRoute(async ({ organizationId }) => {
  const period = await getActivePeriod(organizationId)
  return jsonResponse(period, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
}, { requireOrganization: true })
