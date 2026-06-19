import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse } from '@/lib/api-helpers'
import { ensureDefaultTrainingCategories } from '@/lib/training-categories-seed'

/**
 * POST /api/admin/training-categories/seed
 *
 * Varsayılan kategorileri DB'ye kalıcılaştırır (idempotent). Ayar sayfası,
 * GET'in salt-okunur (id:null) fallback'ini gördüğünde bunu tetikler ki
 * düzenle/sil/sırala işlemleri gerçek id'lerle çalışsın. GET'te write yapılmaz.
 */
export const POST = withAdminRoute(async ({ organizationId }) => {
  await ensureDefaultTrainingCategories(organizationId)
  return jsonResponse({ success: true })
}, { requireOrganization: true })
