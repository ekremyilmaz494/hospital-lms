import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'

/** GET /api/admin/integrations/his/logs — Sayfalı sync log listesi */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams)

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId: dbUser!.organizationId! },
    select: { id: true },
  })

  if (!integration) {
    return jsonResponse({ logs: [], total: 0, page, limit, totalPages: 0 })
  }

  const [logs, total] = await Promise.all([
    prisma.syncLog.findMany({
      where: {
        organizationId: dbUser!.organizationId!,
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
        organizationId: dbUser!.organizationId!,
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
}
