/**
 * POST /api/admin/training-periods/[id]/close — dönemi kapat (geri dönülemez).
 * Body yok. Servisin closePeriod transaction'ını çağırır.
 */

import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse } from '@/lib/api-helpers'
import { closePeriod } from '@/lib/training-periods'

export const POST = withAdminRoute<{ id: string }>(async ({ params, organizationId, dbUser, audit }) => {
  const closed = await closePeriod(params.id, organizationId, dbUser.id)

  await audit({
    action: 'training_period.close',
    entityType: 'training_period',
    entityId: closed.id,
    newData: {
      status: closed.status,
      closedAt: closed.closedAt,
      closedById: closed.closedById,
    },
  })

  return jsonResponse(closed)
}, { requireOrganization: true })
