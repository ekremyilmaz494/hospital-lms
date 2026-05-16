import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/** GET /api/admin/integrations/his/logs/[id] — Sync log detayı (hata listesi dahil) */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const log = await prisma.syncLog.findFirst({
    where: {
      id,
      organizationId, // cross-tenant koruma
    },
  })

  if (!log) return errorResponse('Log kaydı bulunamadı', 404)

  return jsonResponse({ log }, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
}, { strict: true, requireOrganization: true })
