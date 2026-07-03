import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'

/**
 * İK/HBYS entegrasyonu — senkron koşusu geçmişi (hospital-admin).
 *
 * GET → org'un SyncRun listesi, sayfalı (?page=1&limit=20, max 100),
 * en yeni koşu en üstte. Satır ayrıntıları için runs/[id].
 */

const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

// GET /api/admin/integration/runs — senkron koşusu listesi
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams, 100)

  const [total, runs] = await Promise.all([
    prisma.syncRun.count({ where: { organizationId } }),
    prisma.syncRun.findMany({
      where: { organizationId },
      select: {
        id: true,
        integrationId: true,
        channel: true,
        trigger: true,
        mode: true,
        syncMode: true,
        status: true,
        totalRows: true,
        createdRows: true,
        updatedRows: true,
        deactivatedRows: true,
        reactivatedRows: true,
        skippedRows: true,
        failedRows: true,
        fileName: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return jsonResponse(
    {
      runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
