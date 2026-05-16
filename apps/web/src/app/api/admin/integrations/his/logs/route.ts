import { prisma } from '@/lib/prisma'
import { jsonResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/** GET /api/admin/integrations/his/logs — Sayfalı sync log listesi */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams)

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId },
    select: { id: true },
  })

  if (!integration) {
    return jsonResponse(
      { logs: [], total: 0, page, limit, totalPages: 0 },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  }

  const [logs, total] = await Promise.all([
    prisma.syncLog.findMany({
      where: {
        organizationId,
        integrationId: integration.id,
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        syncType: true,
        status: true,
        totalRecords: true,
        processedRecords: true,
        startedAt: true,
        completedAt: true,
        errors: true,
      },
    }),
    prisma.syncLog.count({
      where: {
        organizationId,
        integrationId: integration.id,
      },
    }),
  ])

  const logsWithErrorCount = logs.map(({ errors, ...rest }) => ({
    ...rest,
    errorCount: Array.isArray(errors) ? (errors as unknown[]).length : 0,
  }))

  return jsonResponse({
    logs: logsWithErrorCount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
}, { strict: true, requireOrganization: true })
