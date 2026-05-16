import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * @deprecated 2026-05 — Bu split endpoint dashboard analizinde kaldırıldı (P1 §2.9).
 *
 * Frontend artık tüm dashboard verisini `/api/admin/dashboard/combined` üzerinden
 * tek istekte alıyor. Combined endpoint cache key'i (`dashboard:charts:{orgId}`)
 * paylaşıldığı için bu route'tan yazılan eski mantık verileri kirletebilirdi.
 */
export const GET = withAdminRoute(async () => {
  return errorResponse(
    'Bu uç nokta kullanımdan kaldırıldı; /api/admin/dashboard/combined kullanın',
    410,
  )
}, { requireOrganization: true })
