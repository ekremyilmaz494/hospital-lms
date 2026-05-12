import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * @deprecated 2026-05 — Bu split endpoint dashboard analizinde kaldırıldı (P1 §2.9).
 *
 * Frontend artık tüm dashboard verisini `/api/admin/dashboard/combined` üzerinden
 * tek istekte alıyor. Eski compliance mantığı failed atamaları "overdue" olarak
 * gösteriyordu (P0 §2.1); combined endpoint bu çakışmayı düzeltir.
 */
export const GET = withAdminRoute(async () => {
  return errorResponse(
    'Bu uç nokta kullanımdan kaldırıldı; /api/admin/dashboard/combined kullanın',
    410,
  )
}, { requireOrganization: true })
