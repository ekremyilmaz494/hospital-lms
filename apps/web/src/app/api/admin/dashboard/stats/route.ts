import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * @deprecated 2026-05 — Bu split endpoint dashboard analizinde kaldırıldı (P1 §2.9).
 *
 * Frontend artık tüm dashboard verisini `/api/admin/dashboard/combined` üzerinden
 * tek istekte alıyor. Bu route hâlâ aktif kalırsa combined ile aynı Redis cache
 * key'ine (`dashboard:stats:{orgId}`) farklı TTL ve eski mantıkla yazarak verileri
 * kirletme riski taşıyor — bu yüzden işlevsel kısmı boşaltıldı, 410 Gone döner.
 */
export const GET = withAdminRoute(async () => {
  return errorResponse(
    'Bu uç nokta kullanımdan kaldırıldı; /api/admin/dashboard/combined kullanın',
    410,
  )
}, { requireOrganization: true })
